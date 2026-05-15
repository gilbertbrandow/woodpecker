import os
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from flask import Flask
from flask.testing import FlaskClient

_TRUNCATE_TABLES = (
    "training_attempts, run_training_items, runs, trainings, "
    "schedules, subset_training_items, subsets, users, lichess_tactics, training_items, "
    "lichess_tactics_source_run_metadata, source_import_runs"
)


@pytest.fixture(scope="session")
def app() -> Flask:
    os.environ.setdefault("SECRET_KEY", "test-secret-key")
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql://woodpecker:woodpecker@localhost:5432/woodpecker_test",
    )
    from app import create_app

    flask_app = create_app()
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    return app.test_client()


@pytest.fixture(scope="session")
def _db_schema(app: Flask) -> None:
    with app.app_context():
        from flask_migrate import upgrade
        upgrade()


@pytest.fixture()
def db_session(app: Flask, _db_schema: None):  # type: ignore[misc]
    from app.extensions import db as _db

    with app.app_context():
        yield _db.session
        _db.session.execute(
            sa.text(f"TRUNCATE {_TRUNCATE_TABLES} RESTART IDENTITY CASCADE")
        )
        _db.session.commit()


def _seed_world(session) -> dict[str, object]:  # type: ignore[misc]
    from app.models.user import User
    from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic
    from app.models.subset import Subset, SubsetTrainingItem
    from app.models.schedule import Schedule
    from app.models.training import Training
    from app.models.run import Run, RunTrainingItem, TrainingAttempt

    PUZZLE_ID = "test_spec17_001"
    PUZZLE_FEN = "4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1"
    PUZZLE_SOLUTION = "e8d8 a1a8"
    CHECKMATE_ALT = "h7h8"

    source_run = SourceImportRun(
        source=SourceImportSource.LICHESS_TACTICS,
        operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
        status=SourceImportStatus.SUCCEEDED,
        started_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    session.add(source_run)
    session.flush()

    training_item = TrainingItem(
        source_type=TrainingItemSource.LICHESS_TACTIC,
        source_import_run_id=source_run.id,
    )
    session.add(training_item)
    session.flush()

    tactic = LichessTactic(
        training_item_id=training_item.id,
        puzzle_id=PUZZLE_ID,
        fen=PUZZLE_FEN,
        moves=PUZZLE_SOLUTION,
        rating=1500,
        rating_deviation=100,
        popularity=90,
        nb_plays=100,
        game_url="https://lichess.org/test",
    )
    session.add(tactic)
    session.flush()

    user = User(
        lichess_username=f"testuser_{tactic.id}",
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()

    subset = Subset(
        user_id=user.id,
        name="Test subset",
        puzzle_count=1,
        locked_at=datetime.now(timezone.utc),
        locked_puzzle_count=1,
    )
    session.add(subset)
    session.flush()

    session.add(SubsetTrainingItem(subset_id=subset.id, training_item_id=training_item.id, position=0))
    session.flush()

    schedule_config: dict[str, object] = {
        "runs": [{"target_hours": 168, "break_after_hours": 0}],
        "puzzle_order": "fixed",
        "failed_repetition": {"mode": "queue", "max_repeats": 1},
    }
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Test schedule",
        config=schedule_config,
        locked_at=datetime.now(timezone.utc),
    )
    session.add(schedule)
    session.flush()

    participation = Training(
        user_id=user.id,
        schedule_id=schedule.id,
        started_at=datetime.now(timezone.utc),
    )
    session.add(participation)
    session.flush()

    run = Run(
        training_id=participation.id,
        run_index=0,
        started_at=datetime.now(timezone.utc),
    )
    session.add(run)
    session.flush()

    run_training_item = RunTrainingItem(run_id=run.id, position=0, training_item_id=training_item.id)
    session.add(run_training_item)
    session.flush()

    attempt = TrainingAttempt(
        run_training_item_id=run_training_item.id,
        try_number=1,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
        moves=[],
    )
    session.add(attempt)
    session.flush()

    return {
        "user_id": user.id,
        "run_id": run.id,
        "run_puzzle_id": run_training_item.id,
        "attempt_id": attempt.id,
        "puzzle_fen": PUZZLE_FEN,
        "puzzle_solution": PUZZLE_SOLUTION,
        "solution_player_move": "a1a8",
        "checkmate_alt_move": CHECKMATE_ALT,
    }
