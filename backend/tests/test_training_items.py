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

    def test_in_progress_attempt_returns_404(self, client: FlaskClient, db_session) -> None:
        from app.models.run import RunTrainingItem, TrainingAttempt
        import sqlalchemy as sa

        world = _seed_training_item_world(db_session)
        rp = db_session.execute(
            sa.select(RunTrainingItem).where(
                RunTrainingItem.training_item_id == world["training_item_id"]
            )
        ).scalar_one()
        in_progress = TrainingAttempt(
            run_training_item_id=rp.id,
            try_number=2,
            status="in_progress",
            started_at=datetime.now(timezone.utc),
            moves=[],
        )
        db_session.add(in_progress)
        db_session.flush()

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]
        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempts/{in_progress.id}"
        )
        assert resp.status_code == 404

    def test_attempt_from_different_training_item_returns_404(
        self, client: FlaskClient, db_session
    ) -> None:
        """Attempt ID belongs to a different training item than the URL — should be 404.

        user_a has a completed attempt on item_1 (gate passes), but attempt_b belongs
        to item_2, so the joined query finds no match and returns 404.
        """
        from app.models.source_import_run import (
            SourceImportRun,
            SourceImportSource,
            SourceImportOperation,
            SourceImportStatus,
        )
        from app.models.training_item import TrainingItem, TrainingItemSource
        from app.models.lichess_tactic import LichessTactic
        from app.models.run import RunTrainingItem, TrainingAttempt

        world = _seed_training_item_world(db_session)

        # Create a second training item with a distinct puzzle_id.
        source_run2 = SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.SUCCEEDED,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db_session.add(source_run2)
        db_session.flush()

        item_2 = TrainingItem(
            source_type=TrainingItemSource.LICHESS_TACTIC,
            source_import_run_id=source_run2.id,
        )
        db_session.add(item_2)
        db_session.flush()

        db_session.add(LichessTactic(
            training_item_id=item_2.id,
            puzzle_id="ti_test_IDOR",
            fen="4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1",
            moves="e8d8 a1a8",
            rating=1500,
            rating_deviation=100,
            popularity=90,
            nb_plays=100,
            game_url="https://lichess.org/test2",
        ))
        db_session.flush()

        # Give user_a a RunTrainingItem and a completed attempt on item_2 so the gate
        # passes when we call /training-items/{item_1}/attempts/{attempt_on_item_2}.
        import sqlalchemy as sa
        from app.models.run import Run
        run_a_q = db_session.execute(
            sa.select(Run).join(RunTrainingItem, RunTrainingItem.run_id == Run.id).where(
                RunTrainingItem.training_item_id == world["training_item_id"]
            )
        ).scalars().first()
        rp_item2 = RunTrainingItem(run_id=run_a_q.id, position=1, training_item_id=item_2.id)
        db_session.add(rp_item2)
        db_session.flush()
        attempt_item2 = TrainingAttempt(
            run_training_item_id=rp_item2.id,
            try_number=1,
            status="solved",
            started_at=datetime.now(timezone.utc),
            moves=["a1a8"],
            time_spent_ms=1000,
        )
        db_session.add(attempt_item2)
        db_session.flush()

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        # user_a has an attempt on item_1 (gate passes) but attempt_item2 belongs to item_2.
        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempts/{attempt_item2.id}"
        )
        assert resp.status_code == 404


def _add_failed_attempt(session, world: dict) -> int:  # type: ignore[misc]
    """Add a second (failed) attempt for user_a and return its id."""
    from app.models.run import RunTrainingItem, TrainingAttempt
    import sqlalchemy as sa

    rp = session.execute(
        sa.select(RunTrainingItem).where(
            RunTrainingItem.training_item_id == world["training_item_id"]
        )
    ).scalar_one()
    failed = TrainingAttempt(
        run_training_item_id=rp.id,
        try_number=2,
        status="failed",
        started_at=datetime.now(timezone.utc),
        moves=[],
        time_spent_ms=5000,
    )
    session.add(failed)
    session.flush()
    return int(failed.id)


def _add_user_with_attempt(session, world: dict, username: str, display_name: str) -> dict:  # type: ignore[misc]
    """Add a second user with a solved attempt on the same training item."""
    from app.models.user import User
    from app.models.subset import Subset, SubsetTrainingItem
    from app.models.schedule import Schedule
    from app.models.training import Training
    from app.models.run import Run, RunTrainingItem, TrainingAttempt

    schedule_config: dict[str, object] = {
        "runs": [{"target_hours": 168, "break_after_hours": 0}],
        "puzzle_order": "fixed",
        "failed_repetition": {"mode": "queue", "max_repeats": 1},
    }

    user = User(
        lichess_username=username,
        display_name=display_name,
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()

    subset = Subset(
        user_id=user.id,
        name=f"Subset {display_name}",
        puzzle_count=1,
        locked_at=datetime.now(timezone.utc),
        locked_puzzle_count=1,
    )
    session.add(subset)
    session.flush()
    session.add(
        SubsetTrainingItem(
            subset_id=subset.id,
            training_item_id=world["training_item_id"],
            position=0,
        )
    )

    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name=f"Schedule {display_name}",
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

    run = Run(training_id=training.id, run_index=0, started_at=datetime.now(timezone.utc))
    session.add(run)
    session.flush()

    rp = RunTrainingItem(run_id=run.id, position=0, training_item_id=world["training_item_id"])
    session.add(rp)
    session.flush()

    attempt = TrainingAttempt(
        run_training_item_id=rp.id,
        try_number=1,
        status="solved",
        started_at=datetime.now(timezone.utc),
        moves=["a1a8"],
        time_spent_ms=2000,
    )
    session.add(attempt)
    session.flush()

    return {"user_id": int(user.id), "attempt_id": int(attempt.id)}


@pytest.mark.integration
class TestAttemptHistoryFilters:
    def test_result_filter_returns_only_matching_status(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_training_item_world(db_session)
        _add_failed_attempt(db_session, world)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempt-history?result=failed"
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 1
        assert body["attempts"][0]["result"] == "failed"

    def test_result_filter_solved_excludes_failed(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_training_item_world(db_session)
        _add_failed_attempt(db_session, world)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempt-history?result=solved"
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 1
        assert body["attempts"][0]["result"] == "solved"

    def test_user_id_filter_returns_only_that_users_attempts(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_training_item_world(db_session)
        extra = _add_user_with_attempt(db_session, world, "user_c_ti_test", "User C")

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempt-history"
            f"?userId={world['user_a_id']}"
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 1
        assert body["attempts"][0]["userId"] == world["user_a_id"]

        # Filter to other user — user_a can see it because they have own attempt
        resp2 = client.get(
            f"/training-items/{world['training_item_id']}/attempt-history"
            f"?userId={extra['user_id']}"
        )
        assert resp2.status_code == 200
        body2 = resp2.get_json()
        assert body2["total"] == 1
        assert body2["attempts"][0]["userId"] == extra["user_id"]

    def test_all_users_returned_without_user_id_filter(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_training_item_world(db_session)
        _add_user_with_attempt(db_session, world, "user_d_ti_test", "User D")

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        resp = client.get(f"/training-items/{world['training_item_id']}/attempt-history")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 2

    def test_pagination_second_page_empty_when_only_one_row(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempt-history?page=2&pageSize=1"
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 1
        assert body["attempts"] == []

    def test_invalid_user_id_is_ignored(self, client: FlaskClient, db_session) -> None:
        world = _seed_training_item_world(db_session)
        with client.session_transaction() as sess:
            sess["user_id"] = world["user_a_id"]

        # Non-integer userId values are silently skipped — no filter applied, all results returned.
        resp = client.get(
            f"/training-items/{world['training_item_id']}/attempt-history?userId=notanumber"
        )
        assert resp.status_code == 200
