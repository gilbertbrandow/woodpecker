from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient


def _seed_training_item_world(session) -> dict[str, object]:  # type: ignore[misc]
    from app.models.user import User
    from app.models.source_import_run import (
        SourceImportRun,
        SourceImportSource,
        SourceImportOperation,
        SourceImportStatus,
    )
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic
    from app.models.subset import Subset, SubsetTrainingItem
    from app.models.schedule import Schedule
    from app.models.training import Training
    from app.models.run import Run, RunTrainingItem, TrainingAttempt

    PUZZLE_FEN = "4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1"
    PUZZLE_SOLUTION = "e8d8 a1a8"

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
        puzzle_id="ti_test_001",
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

    schedule_config: dict[str, object] = {
        "runs": [{"target_hours": 168, "break_after_hours": 0}],
        "puzzle_order": "fixed",
        "failed_repetition": {"mode": "queue", "max_repeats": 1},
    }

    # user_a has a completed attempt on the training item
    user_a = User(
        lichess_username="user_a_ti_test",
        display_name="User A",
        created_at=datetime.now(timezone.utc),
    )
    session.add(user_a)
    session.flush()

    subset_a = Subset(
        user_id=user_a.id,
        name="Subset A",
        puzzle_count=1,
        locked_at=datetime.now(timezone.utc),
        locked_puzzle_count=1,
    )
    session.add(subset_a)
    session.flush()
    session.add(SubsetTrainingItem(subset_id=subset_a.id, training_item_id=training_item.id, position=0))

    schedule_a = Schedule(
        user_id=user_a.id,
        subset_id=subset_a.id,
        name="Schedule A",
        config=schedule_config,
        locked_at=datetime.now(timezone.utc),
    )
    session.add(schedule_a)
    session.flush()

    training_a = Training(
        user_id=user_a.id,
        schedule_id=schedule_a.id,
        started_at=datetime.now(timezone.utc),
    )
    session.add(training_a)
    session.flush()

    run_a = Run(training_id=training_a.id, run_index=0, started_at=datetime.now(timezone.utc))
    session.add(run_a)
    session.flush()

    rp_a = RunTrainingItem(run_id=run_a.id, position=0, training_item_id=training_item.id)
    session.add(rp_a)
    session.flush()

    attempt_a = TrainingAttempt(
        run_training_item_id=rp_a.id,
        try_number=1,
        status="solved",
        started_at=datetime.now(timezone.utc),
        moves=["a1a8"],
        time_spent_ms=3000,
    )
    session.add(attempt_a)
    session.flush()

    # user_b has no RunTrainingItem for this training item
    user_b = User(
        lichess_username="user_b_ti_test",
        display_name="User B",
        created_at=datetime.now(timezone.utc),
    )
    session.add(user_b)
    session.flush()

    return {
        "training_item_id": training_item.id,
        "user_a_id": user_a.id,
        "user_b_id": user_b.id,
        "attempt_a_id": attempt_a.id,
    }


@pytest.mark.integration
class TestAttemptHistory:
    def test_unauthenticated_returns_401(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        resp = client.get(f"/training-items/{world['training_item_id']}/attempt-history")
        assert resp.status_code == 401

    def test_forbidden_without_own_attempt(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_b_id"]
        resp = client.get(f"/training-items/{world['training_item_id']}/attempt-history")
        assert resp.status_code == 403

    def test_returns_attempts_for_authorised_user(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]
        resp = client.get(f"/training-items/{world['training_item_id']}/attempt-history")
        assert resp.status_code == 200
        body = resp.get_json()
        assert "attempts" in body
        assert len(body["attempts"]) == 1
        row = body["attempts"][0]
        assert row["attemptId"] == world["attempt_a_id"]
        assert row["userId"] == world["user_a_id"]
        assert row["result"] == "solved"
        assert row["countsTowardsTraining"] is True


@pytest.mark.integration
class TestSpectateView:
    def test_forbidden_without_own_attempt(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_b_id"]
        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempts/{world['attempt_a_id']}"
        )
        assert resp.status_code == 403

    def test_returns_spectate_view_for_authorised_user(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]
        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempts/{world['attempt_a_id']}"
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["attemptId"] == world["attempt_a_id"]
        assert "board" in body
        assert "pgnDisplay" in body

    def test_not_found_for_nonexistent_attempt(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]
        resp = client.get(f"/training-items/{world['training_item_id']}/attempts/999999")
        assert resp.status_code == 404
