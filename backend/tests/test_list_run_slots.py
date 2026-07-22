"""Integration tests for list_run_slots.

Covers: not_started placeholders, scheduledStartAt computation, real runs
in slots, and the priority rule (non-aborted beats aborted at the same index).
"""

import pytest
from datetime import datetime, timedelta, timezone

BASE = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)


def _dt(hours: float) -> datetime:
    return BASE + timedelta(hours=hours)


def _seed(session, run_defs: list[dict]) -> dict:
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

    item = TrainingItem(
        source_type=TrainingItemSource.LICHESS_TACTIC,
        source_import_run_id=source_run.id,
    )
    session.add(item)
    session.flush()

    session.add(LichessTactic(
        training_item_id=item.id,
        puzzle_id=f"slots_test_{item.id}",
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
        lichess_username=f"slots_user_{item.id}",
        display_name=f"slots_user_{item.id}",
        created_at=BASE,
    )
    session.add(user)
    session.flush()

    subset = Subset(
        user_id=user.id,
        name="Slots test subset",
        puzzle_count=1,
        locked_at=BASE,
        locked_puzzle_count=1,
    )
    session.add(subset)
    session.flush()

    session.add(SubsetTrainingItem(subset_id=subset.id, training_item_id=item.id, position=0))
    session.flush()

    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Slots test schedule",
        config={
            "runs": run_defs,
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

    return {"training_id": training.id, "item_id": item.id}


@pytest.mark.integration
class TestListRunSlots:
    def test_fresh_training_all_not_started(self, db_session) -> None:
        """A new training with no runs returns N not_started placeholders."""
        world = _seed(db_session, [
            {"target_hours": 8, "break_after_hours": 48},
            {"target_hours": 16, "break_after_hours": 0},
        ])
        from app.services.run import list_run_slots
        result = list_run_slots(world["training_id"])
        assert result["total"] == 2
        slots = result["items"]
        assert len(slots) == 2
        assert slots[0]["status"] == "not_started"
        assert slots[0]["runIndex"] == 0
        assert slots[1]["status"] == "not_started"
        assert slots[1]["runIndex"] == 1

    def test_slot0_scheduled_start_equals_training_start(self, db_session) -> None:
        """Slot 0 placeholder scheduledStartAt equals training.started_at."""
        world = _seed(db_session, [
            {"target_hours": 8, "break_after_hours": 0},
        ])
        from app.services.run import list_run_slots
        result = list_run_slots(world["training_id"])
        slot = result["items"][0]
        assert slot["scheduledStartAt"] == BASE.isoformat()

    def test_slot1_scheduled_start_after_break(self, db_session) -> None:
        """Slot 1 scheduledStartAt = run0.completed_at + break_hours."""
        from app.models.run import Run, RunTrainingItem
        world = _seed(db_session, [
            {"target_hours": 8, "break_after_hours": 48},
            {"target_hours": 16, "break_after_hours": 0},
        ])
        tid = world["training_id"]

        run0 = Run(training_id=tid, run_index=0, started_at=BASE, completed_at=_dt(8))
        db_session.add(run0)
        db_session.flush()

        rti = RunTrainingItem(run_id=run0.id, position=0, training_item_id=world["item_id"])
        db_session.add(rti)
        db_session.flush()

        from app.services.run import list_run_slots
        result = list_run_slots(tid)
        slots = result["items"]

        assert slots[0]["status"] == "completed"
        assert slots[0]["id"] == run0.id

        expected_break_end = _dt(8 + 48)
        assert slots[1]["status"] == "not_started"
        assert slots[1]["scheduledStartAt"] == expected_break_end.isoformat()

    def test_slot1_no_scheduled_start_when_prev_not_completed(self, db_session) -> None:
        """Slot 1 scheduledStartAt is None when run0 is active (not completed)."""
        from app.models.run import Run, RunTrainingItem
        world = _seed(db_session, [
            {"target_hours": 8, "break_after_hours": 48},
            {"target_hours": 16, "break_after_hours": 0},
        ])
        tid = world["training_id"]

        run0 = Run(training_id=tid, run_index=0, started_at=BASE)
        db_session.add(run0)
        db_session.flush()
        db_session.add(RunTrainingItem(run_id=run0.id, position=0, training_item_id=world["item_id"]))
        db_session.flush()

        from app.services.run import list_run_slots
        result = list_run_slots(tid)
        assert result["items"][1]["scheduledStartAt"] is None

    def test_aborted_run_shown_at_slot(self, db_session) -> None:
        """An aborted run appears at its slot index rather than a not_started placeholder."""
        from app.models.run import Run, RunTrainingItem
        world = _seed(db_session, [
            {"target_hours": 8, "break_after_hours": 0},
            {"target_hours": 8, "break_after_hours": 0},
        ])
        tid = world["training_id"]

        aborted = Run(training_id=tid, run_index=0, started_at=BASE, aborted_at=_dt(4))
        db_session.add(aborted)
        db_session.flush()
        db_session.add(RunTrainingItem(run_id=aborted.id, position=0, training_item_id=world["item_id"]))
        db_session.flush()

        from app.services.run import list_run_slots
        result = list_run_slots(tid)
        assert result["items"][0]["status"] == "aborted"
        assert result["items"][0]["id"] == aborted.id

    def test_non_aborted_preferred_over_aborted_at_same_index(self, db_session) -> None:
        """When both an aborted and active run exist at index 0, active wins."""
        from app.models.run import Run, RunTrainingItem
        world = _seed(db_session, [
            {"target_hours": 8, "break_after_hours": 0},
        ])
        tid = world["training_id"]

        aborted = Run(training_id=tid, run_index=0, started_at=BASE, aborted_at=_dt(2))
        db_session.add(aborted)
        db_session.flush()
        db_session.add(RunTrainingItem(run_id=aborted.id, position=0, training_item_id=world["item_id"]))
        db_session.flush()

        active = Run(training_id=tid, run_index=0, started_at=_dt(3))
        db_session.add(active)
        db_session.flush()
        db_session.add(RunTrainingItem(run_id=active.id, position=0, training_item_id=world["item_id"]))
        db_session.flush()

        from app.services.run import list_run_slots
        result = list_run_slots(tid)
        slot = result["items"][0]
        assert slot["status"] == "active"
        assert slot["id"] == active.id
