"""Tests for get_training_progress, focusing on the updated-expected anchor ordering.

The bug being guarded: when a user starts an active run BEFORE the previous run's
scheduled break ends, the is_active branch used to append a (now_ms, actual_at_now)
anchor that was chronologically EARLIER than the break-end anchor already in the list.
_interpolate_anchors scans linearly and hit the stale flat-break pair first, returning
the wrong value (100 instead of 101 in the scenario below).
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import patch

MS_PER_HOUR = 3_600_000
BASE = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
BASE_MS = int(BASE.timestamp() * 1000)


def _dt(hours_offset: float) -> datetime:
    return datetime.fromtimestamp((BASE_MS + int(hours_offset * MS_PER_HOUR)) / 1000, tz=timezone.utc)


def _seed_world(session, puzzle_count: int = 100):
    from app.models.user import User
    from app.models.source_import_run import (
        SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus,
    )
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic
    from app.models.subset import Subset, SubsetTrainingItem
    from app.models.schedule import Schedule
    from app.models.training import Training

    source_run = SourceImportRun(
        source=SourceImportSource.LICHESS_TACTICS,
        operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
        status=SourceImportStatus.SUCCEEDED,
        started_at=BASE,
        finished_at=BASE,
    )
    session.add(source_run)
    session.flush()

    training_item = TrainingItem(
        source_type=TrainingItemSource.LICHESS_TACTIC,
        source_import_run_id=source_run.id,
    )
    session.add(training_item)
    session.flush()

    session.add(LichessTactic(
        training_item_id=training_item.id,
        puzzle_id=f"prog_test_{training_item.id}",
        fen="4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1",
        moves="e8d8 a1a8",
        rating=1500,
        rating_deviation=100,
        popularity=90,
        nb_plays=100,
        game_url="https://lichess.org/test",
    ))
    session.flush()

    user = User(
        lichess_username=f"proguser_{training_item.id}",
        display_name=f"proguser_{training_item.id}",
        created_at=BASE,
    )
    session.add(user)
    session.flush()

    subset = Subset(
        user_id=user.id,
        name="Progress test subset",
        puzzle_count=puzzle_count,
        locked_at=BASE,
        locked_puzzle_count=puzzle_count,
    )
    session.add(subset)
    session.flush()

    session.add(SubsetTrainingItem(subset_id=subset.id, training_item_id=training_item.id, position=0))
    session.flush()

    # Two-run schedule: run0 (8h + 48h break), run1 (16h, no break).
    # Scheduled break ends at BASE+8h+48h = BASE+56h.
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Progress test schedule",
        config={
            "runs": [
                {"target_hours": 8, "break_after_hours": 48},
                {"target_hours": 16, "break_after_hours": 0},
            ],
            "puzzle_order": "fixed",
            "failed_repetition": {"mode": "queue", "max_repeats": 1},
        },
        locked_at=BASE,
    )
    session.add(schedule)
    session.flush()

    training = Training(user_id=user.id, schedule_id=schedule.id, started_at=BASE)
    session.add(training)
    session.flush()

    return {"user_id": user.id, "training_id": training.id, "training_item_id": training_item.id}


def _call_at(training_id: int, user_id: int, now: datetime):
    from app.services.training import get_training_progress
    with patch("app.services.training.datetime") as mock_dt:
        mock_dt.now.return_value = now
        return get_training_progress(training_id, user_id)


@pytest.mark.integration
class TestGetTrainingProgressEarlyStart:
    def test_early_start_updated_expected_anchored_at_actual_progress(self, db_session) -> None:
        """updatedExpected at now_ms must equal actual_at_now when the active run started
        before the previous run's scheduled break ended (early start scenario).

        Schedule: run0 (8 h, then 48 h break), run1 (16 h).
        Break would end at BASE+56h. User starts run1 at BASE+30h (26h early).
        now = BASE+38h. active_resolved=1. actual_at_now = 100+1 = 101.

        Old bug: the break-end anchor at BASE+56h preceded the now_ms anchor at BASE+38h
        in the list, so _interpolate_anchors returned 100 (flat break) instead of 101.
        """
        from app.models.run import Run, RunTrainingItem, TrainingAttempt

        world = _seed_world(db_session, puzzle_count=100)
        tid = world["training_id"]
        uid = world["user_id"]
        item_id = world["training_item_id"]

        run0 = Run(training_id=tid, run_index=0, started_at=BASE, completed_at=_dt(8))
        db_session.add(run0)
        db_session.flush()

        # run1 started at BASE+30h, before the scheduled break end at BASE+56h
        run1 = Run(training_id=tid, run_index=1, started_at=_dt(30))
        db_session.add(run1)
        db_session.flush()

        rti = RunTrainingItem(run_id=run1.id, position=0, training_item_id=item_id)
        db_session.add(rti)
        db_session.flush()

        # One resolved attempt in run1 → active_resolved=1
        db_session.add(TrainingAttempt(
            run_training_item_id=rti.id,
            try_number=1,
            status="solved",
            started_at=_dt(30),
            completed_at=_dt(31),
        ))
        db_session.flush()

        result = _call_at(tid, uid, now=_dt(38))

        now_ms = result["nowMs"]
        now_point = next(p for p in result["points"] if p["timeMs"] == now_ms)
        # actual_at_now = 1 completed run × 100 + 1 active_resolved = 101
        assert now_point["updatedExpected"] == pytest.approx(101.0)

    def test_on_time_start_updated_expected_anchored_at_actual_progress(self, db_session) -> None:
        """On-time start (run1 at break end) must also satisfy the invariant: regression."""
        from app.models.run import Run, RunTrainingItem, TrainingAttempt

        world = _seed_world(db_session, puzzle_count=100)
        tid = world["training_id"]
        uid = world["user_id"]
        item_id = world["training_item_id"]

        run0 = Run(training_id=tid, run_index=0, started_at=BASE, completed_at=_dt(8))
        db_session.add(run0)
        db_session.flush()

        # run1 started exactly when the break ends (on time)
        run1 = Run(training_id=tid, run_index=1, started_at=_dt(56))
        db_session.add(run1)
        db_session.flush()

        rti = RunTrainingItem(run_id=run1.id, position=0, training_item_id=item_id)
        db_session.add(rti)
        db_session.flush()

        db_session.add(TrainingAttempt(
            run_training_item_id=rti.id,
            try_number=1,
            status="solved",
            started_at=_dt(56),
            completed_at=_dt(57),
        ))
        db_session.flush()

        result = _call_at(tid, uid, now=_dt(64))

        now_ms = result["nowMs"]
        now_point = next(p for p in result["points"] if p["timeMs"] == now_ms)
        assert now_point["updatedExpected"] == pytest.approx(101.0)
