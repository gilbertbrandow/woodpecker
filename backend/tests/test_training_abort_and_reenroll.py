import pytest
from datetime import datetime, timezone

from flask.testing import FlaskClient
from tests.conftest import _seed_world  # type: ignore[import]


def _seed_base(session):
    """Seed a user, schedule, and training without an active run."""
    from app.models.user import User
    from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic
    from app.models.subset import Subset, SubsetTrainingItem
    from app.models.schedule import Schedule
    from app.models.training import Training

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
        puzzle_id=f"abort_test_{training_item.id}",
        fen="4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1",
        moves="e8d8 a1a8",
        rating=1500,
        rating_deviation=100,
        popularity=90,
        nb_plays=100,
        game_url="https://lichess.org/test",
    )
    session.add(tactic)
    session.flush()

    user = User(
        lichess_username=f"abortuser_{training_item.id}",
        display_name=f"abortuser_{training_item.id}",
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()

    subset = Subset(
        user_id=user.id,
        name="Abort test subset",
        puzzle_count=1,
        locked_at=datetime.now(timezone.utc),
        locked_puzzle_count=1,
    )
    session.add(subset)
    session.flush()

    session.add(SubsetTrainingItem(subset_id=subset.id, training_item_id=training_item.id, position=0))
    session.flush()

    schedule_config = {
        "runs": [{"target_hours": 168, "break_after_hours": 0}],
        "puzzle_order": "fixed",
        "failed_repetition": {"mode": "queue", "max_repeats": 1},
    }
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Abort test schedule",
        config=schedule_config,
        locked_at=datetime.now(timezone.utc),
    )
    session.add(schedule)
    session.flush()

    training = Training(
        user_id=user.id,
        schedule_id=schedule.id,
        started_at=datetime.now(timezone.utc),
    )
    session.add(training)
    session.flush()

    return {"user_id": user.id, "schedule_id": schedule.id, "training_id": training.id}


@pytest.mark.integration
class TestAbortTrainingCascade:
    def test_abort_training_with_active_run_also_aborts_run(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_world(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        from app.models.run import Run
        run = db_session.get(Run, world["run_id"])
        assert run is not None
        training_id = run.training_id

        resp = client.post(f"/training/{training_id}/abort")
        assert resp.status_code == 200

        db_session.expire_all()
        run = db_session.get(Run, world["run_id"])
        assert run is not None
        assert run.aborted_at is not None

    def test_abort_training_without_active_run_succeeds(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_base(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        resp = client.post(f"/training/{world['training_id']}/abort")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["abortedAt"] is not None

    def test_abort_already_aborted_training_returns_error(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_base(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        client.post(f"/training/{world['training_id']}/abort")
        resp = client.post(f"/training/{world['training_id']}/abort")
        assert resp.status_code == 409


@pytest.mark.integration
class TestReenrollAfterAbort:
    def test_create_training_succeeds_when_existing_training_is_aborted(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_base(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        client.post(f"/training/{world['training_id']}/abort")

        resp = client.post("/training", json={"scheduleId": world["schedule_id"]})
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["id"] != world["training_id"]

    def test_create_training_fails_when_non_terminal_training_exists(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_base(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        resp = client.post("/training", json={"scheduleId": world["schedule_id"]})
        assert resp.status_code == 409

    def test_after_abort_cascade_can_start_run_in_another_training(
        self, client: FlaskClient, db_session
    ) -> None:
        """Aborting a Training with an active Run must not leave a dangling active Run
        that blocks starting Runs in other Trainings."""
        world = _seed_world(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        from app.models.run import Run
        run = db_session.get(Run, world["run_id"])
        training_id = run.training_id

        # Abort the training (cascades to its active Run)
        abort_resp = client.post(f"/training/{training_id}/abort")
        assert abort_resp.status_code == 200

        # Create a second training for the same schedule
        from app.models.training import Training
        training = db_session.get(Training, training_id)
        assert training is not None

        new_training_resp = client.post("/training", json={"scheduleId": training.schedule_id})
        assert new_training_resp.status_code == 201
        new_training_id = new_training_resp.get_json()["id"]

        # Starting a run in the new training must succeed
        start_resp = client.post(f"/training/{new_training_id}/runs", json={})
        assert start_resp.status_code == 201
