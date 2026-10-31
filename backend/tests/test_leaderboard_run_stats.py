from datetime import UTC, datetime

import pytest

from app.services import leaderboard as leaderboard_svc
from app.table_query import FilterList

_NOW = datetime.now(UTC)


def _make_lichess_item(session, source_run_id: int, game_id: int, rating: int, n: int):  # type: ignore[misc]
    from app.models.lichess_tactic import LichessTactic
    from app.models.training_item import TrainingItem, TrainingItemSource
    item = TrainingItem(
        source_type=TrainingItemSource.LICHESS_TACTIC,
        source_import_run_id=source_run_id,
    )
    session.add(item)
    session.flush()
    session.add(LichessTactic(
        training_item_id=item.id,
        puzzle_id=f"lb_stats_{n}",
        fen="4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1",
        moves="e8d8 a1a8",
        rating=rating,
        rating_deviation=100,
        popularity=90,
        nb_plays=100,
        game_id=game_id,
    ))
    session.flush()
    return item


def _make_items(session, ratings: list[int]) -> list:  # type: ignore[type-arg]
    from app.models.game import SourceGame
    from app.models.source_import_run import (
        SourceImportOperation,
        SourceImportRun,
        SourceImportSource,
        SourceImportStatus,
    )
    source_run = SourceImportRun(
        source=SourceImportSource.LICHESS_TACTICS,
        operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
        status=SourceImportStatus.SUCCEEDED,
        started_at=_NOW,
        finished_at=_NOW,
    )
    session.add(source_run)
    session.flush()
    game = SourceGame(white="?", black="?", moves="e2e4", source_import_run_id=source_run.id)
    session.add(game)
    session.flush()
    return [_make_lichess_item(session, source_run.id, game.id, r, n) for n, r in enumerate(ratings)]


def _make_training(session, username: str):  # type: ignore[misc]
    from app.models.schedule import Schedule
    from app.models.subset import Subset
    from app.models.training import Training
    from app.models.user import User
    user = User(lichess_username=username, display_name=username, created_at=_NOW)
    session.add(user)
    session.flush()
    subset = Subset(user_id=user.id, name="s", puzzle_count=6)
    session.add(subset)
    session.flush()
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name=f"{username} schedule",
        config={
            "puzzle_order": "fixed",
            "failed_repetition": {"mode": "none"},
            "runs": [
                {"target_hours": 24, "break_after_hours": 0},
                {"target_hours": 24, "break_after_hours": 0},
            ],
        },
    )
    session.add(schedule)
    session.flush()
    training = Training(user_id=user.id, schedule_id=schedule.id, started_at=_NOW)
    session.add(training)
    session.flush()
    return schedule, training


def _make_run(session, training, run_index: int, items: list, attempts: list[list[tuple[str, int | None]]]):  # type: ignore[misc, type-arg]
    from app.models.run import Run, RunTrainingItem, TrainingAttempt
    run = Run(training_id=training.id, run_index=run_index, started_at=_NOW)
    session.add(run)
    session.flush()
    for position, (item, item_attempts) in enumerate(zip(items, attempts)):
        rti = RunTrainingItem(run_id=run.id, position=position, training_item_id=item.id)
        session.add(rti)
        session.flush()
        for try_number, (status, time_spent_ms) in enumerate(item_attempts, start=1):
            session.add(TrainingAttempt(
                run_training_item_id=rti.id,
                try_number=try_number,
                status=status,
                started_at=_NOW,
                completed_at=None if status == "in_progress" else _NOW,
                time_spent_ms=time_spent_ms,
                moves=[],
            ))
    session.flush()
    return run


def _seed(session) -> dict[str, object]:  # type: ignore[misc]
    items = _make_items(session, [1000, 1100, 1200, 1300, 1400, 1500])
    schedule, training = _make_training(session, "lb_stats_alice")
    run_0 = _make_run(session, training, 0, items[:2], [
        [("solved", 500)],
        [("failed", 700)],
    ])
    run_1 = _make_run(session, training, 1, items, [
        [],
        [("solved", 1000)],
        [("failed", 3000), ("solved", 2000)],
        [("failed", 4000), ("failed", 5000)],
        [("in_progress", None)],
        [("failed", 800), ("in_progress", None)],
    ])
    other_schedule, other_training = _make_training(session, "lb_stats_bob")
    other_run = _make_run(session, other_training, 1, items[:1], [[("solved", 9000)]])
    return {
        "schedule": schedule,
        "run_0": run_0,
        "run_1": run_1,
        "other_schedule": other_schedule,
        "other_run": other_run,
    }


def _board(schedule_id: int | None = None, run_index: int | None = None) -> dict[int, dict[str, object]]:
    items, _ = leaderboard_svc.get_run_board(
        schedule_filter=FilterList(op="is", int_values=[schedule_id]) if schedule_id is not None else None,
        run_index=run_index,
        exclude_aborted=True,
    )
    return {int(str(i["runId"])): i for i in items}


@pytest.mark.integration
class TestRunBoardStats:

    def test_stats_cover_every_attempt_shape(self, db_session) -> None:
        world = _seed(db_session)

        board = _board(world["schedule"].id, run_index=1)  # type: ignore[attr-defined]

        assert set(board) == {world["run_1"].id}  # type: ignore[attr-defined]
        row = board[world["run_1"].id]  # type: ignore[attr-defined]
        assert row["totalPuzzles"] == 6
        assert row["firstSolvedCount"] == 1
        assert row["resolvedCount"] == 4
        assert row["accuracyPct"] == 25.0
        assert row["avgRating"] == pytest.approx(1250.0)
        assert row["avgSolveTimeMs"] == pytest.approx(2200.0)
        assert row["avgTimeSolvedMs"] == pytest.approx(1000.0)
        assert row["avgTimeFailedMs"] == pytest.approx(8800 / 3)
        assert row["deltaAccuracyPct"] == -25.0

    def test_previous_run_has_no_delta(self, db_session) -> None:
        world = _seed(db_session)

        board = _board(world["schedule"].id, run_index=0)  # type: ignore[attr-defined]

        row = board[world["run_0"].id]  # type: ignore[attr-defined]
        assert row["totalPuzzles"] == 2
        assert row["firstSolvedCount"] == 1
        assert row["resolvedCount"] == 2
        assert row["accuracyPct"] == 50.0
        assert row["avgTimeSolvedMs"] == pytest.approx(500.0)
        assert row["avgTimeFailedMs"] == pytest.approx(700.0)
        assert row["deltaAccuracyPct"] is None

    def test_other_schedules_do_not_leak_into_stats(self, db_session) -> None:
        world = _seed(db_session)

        board = _board(world["other_schedule"].id, run_index=1)  # type: ignore[attr-defined]

        assert set(board) == {world["other_run"].id}  # type: ignore[attr-defined]
        row = board[world["other_run"].id]  # type: ignore[attr-defined]
        assert row["totalPuzzles"] == 1
        assert row["accuracyPct"] == 100.0
        assert row["avgSolveTimeMs"] == pytest.approx(9000.0)
        assert row["deltaAccuracyPct"] is None

    def test_unfiltered_board_computes_stats_for_all_runs(self, db_session) -> None:
        world = _seed(db_session)

        board = _board()

        assert set(board) == {
            world["run_0"].id,  # type: ignore[attr-defined]
            world["run_1"].id,  # type: ignore[attr-defined]
            world["other_run"].id,  # type: ignore[attr-defined]
        }
        assert board[world["run_1"].id]["accuracyPct"] == 25.0  # type: ignore[attr-defined]
        assert board[world["run_1"].id]["deltaAccuracyPct"] == -25.0  # type: ignore[attr-defined]
        assert board[world["run_0"].id]["accuracyPct"] == 50.0  # type: ignore[attr-defined]
        assert board[world["other_run"].id]["accuracyPct"] == 100.0  # type: ignore[attr-defined]
