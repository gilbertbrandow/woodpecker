import os
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from flask import Flask
from flask.testing import FlaskClient

_TRUNCATE_TABLES = (
    "puzzle_attempts, run_puzzles, runs, schedule_participations, "
    "schedules, subset_puzzles, subsets, users, puzzles"
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
    from app.models.puzzle import Puzzle
    from app.models.subset import Subset, SubsetPuzzle
    from app.models.schedule import Schedule
    from app.models.schedule_participation import ScheduleParticipation
    from app.models.run import Run, RunPuzzle, PuzzleAttempt

    PUZZLE_ID = "test_spec17_001"
    PUZZLE_FEN = "4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1"
    PUZZLE_SOLUTION = "e8d8 a1a8"
    CHECKMATE_ALT = "h7h8"

    puzzle = Puzzle(
        puzzle_id=PUZZLE_ID,
        fen=PUZZLE_FEN,
        moves=PUZZLE_SOLUTION,
        rating=1500,
        rating_deviation=100,
        popularity=90,
        nb_plays=100,
        game_url="https://lichess.org/test",
    )
    session.add(puzzle)
    session.flush()

    user = User(
        lichess_username=f"testuser_{puzzle.id}",
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

    session.add(SubsetPuzzle(subset_id=subset.id, puzzle_id=puzzle.id, position=0))
    session.flush()

    schedule_config: dict[str, object] = {
        "runs": [{"target_hours": 168}],
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

    participation = ScheduleParticipation(
        user_id=user.id,
        schedule_id=schedule.id,
        started_at=datetime.now(timezone.utc),
    )
    session.add(participation)
    session.flush()

    run = Run(
        participation_id=participation.id,
        run_index=0,
        started_at=datetime.now(timezone.utc),
    )
    session.add(run)
    session.flush()

    run_puzzle = RunPuzzle(run_id=run.id, position=0, puzzle_id=puzzle.id)
    session.add(run_puzzle)
    session.flush()

    attempt = PuzzleAttempt(
        run_puzzle_id=run_puzzle.id,
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
        "run_puzzle_id": run_puzzle.id,
        "attempt_id": attempt.id,
        "puzzle_fen": PUZZLE_FEN,
        "puzzle_solution": PUZZLE_SOLUTION,
        "solution_player_move": "a1a8",
        "checkmate_alt_move": CHECKMATE_ALT,
    }
