"""Integration tests for GET /training/all — subsetName response and date filters (#199)."""
from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient


def _login(client: FlaskClient, user_id: int) -> None:
    with client.session_transaction() as sess:
        sess["user_id"] = user_id


def _make_user(session, username: str):  # type: ignore[misc]
    from app.models.user import User
    user = User(
        lichess_username=username,
        display_name=username,
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()
    return user


def _make_subset(session, user, name: str = "Test subset"):  # type: ignore[misc]
    from app.models.subset import Subset
    subset = Subset(user_id=user.id, name=name, puzzle_count=10)
    session.add(subset)
    session.flush()
    return subset


_RUN = {"target_hours": 24, "break_after_hours": 0}
_BASE_CONFIG: dict[str, object] = {
    "puzzle_order": "fixed",
    "failed_repetition": {"mode": "none"},
}


def _make_schedule(session, user, subset, name: str = "Test schedule"):  # type: ignore[misc]
    from app.models.schedule import Schedule
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name=name,
        config={**_BASE_CONFIG, "runs": [_RUN]},
    )
    session.add(schedule)
    session.flush()
    return schedule


def _make_training(session, user, schedule, *, started_at: datetime, completed_at: datetime | None = None):  # type: ignore[misc]
    from app.models.training import Training
    training = Training(
        user_id=user.id,
        schedule_id=schedule.id,
        started_at=started_at,
        completed_at=completed_at,
    )
    session.add(training)
    session.flush()
    return training


@pytest.mark.integration
class TestTrainingListFilters:

    def test_subset_name_in_response(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "tlf_subset_name")
        _login(client, user.id)
        subset = _make_subset(db_session, user, name="My Subset")
        schedule = _make_schedule(db_session, user, subset)
        _make_training(db_session, user, schedule, started_at=datetime.now(timezone.utc))

        resp = client.get("/training/all")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        assert len(items) >= 1
        matching = [t for t in items if t["scheduleId"] == schedule.id]
        assert len(matching) == 1
        assert matching[0]["subsetName"] == "My Subset"

    def test_started_at_filter_after(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "tlf_started_after")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        schedule = _make_schedule(db_session, user, subset)
        old = _make_training(db_session, user, schedule,
                             started_at=datetime(2023, 1, 1, tzinfo=timezone.utc))
        recent = _make_training(db_session, user, schedule,
                                started_at=datetime(2025, 6, 1, tzinfo=timezone.utc))

        resp = client.get("/training/all?startedAt=after&startedAt=2025-01-01")

        assert resp.status_code == 200
        ids = {t["id"] for t in resp.get_json()["items"]}
        assert recent.id in ids
        assert old.id not in ids

    def test_completed_at_is_set(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "tlf_completed_set")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        schedule = _make_schedule(db_session, user, subset)
        done = _make_training(db_session, user, schedule,
                              started_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
                              completed_at=datetime(2025, 3, 1, tzinfo=timezone.utc))
        in_progress = _make_training(db_session, user, schedule,
                                     started_at=datetime(2025, 4, 1, tzinfo=timezone.utc))

        resp = client.get("/training/all?completedAt=set")

        assert resp.status_code == 200
        ids = {t["id"] for t in resp.get_json()["items"]}
        assert done.id in ids
        assert in_progress.id not in ids

    def test_completed_at_not_set(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "tlf_completed_not_set")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        schedule = _make_schedule(db_session, user, subset)
        done = _make_training(db_session, user, schedule,
                              started_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
                              completed_at=datetime(2025, 3, 1, tzinfo=timezone.utc))
        in_progress = _make_training(db_session, user, schedule,
                                     started_at=datetime(2025, 4, 1, tzinfo=timezone.utc))

        resp = client.get("/training/all?completedAt=not_set")

        assert resp.status_code == 200
        ids = {t["id"] for t in resp.get_json()["items"]}
        assert in_progress.id in ids
        assert done.id not in ids
