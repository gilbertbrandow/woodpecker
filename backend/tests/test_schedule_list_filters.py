"""Integration tests for GET /schedules filter params added in #199.

Covers: runCount (JSONB), puzzleCount (JOIN), subsetIds (FilterList),
subsetPuzzleCount in response, and date filter.
"""
from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient


# ── Helpers ──────────────────────────────────────────────────────────────────────

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


def _make_subset(session, user, puzzle_count: int = 10):  # type: ignore[misc]
    from app.models.subset import Subset
    subset = Subset(user_id=user.id, name="Test subset", puzzle_count=puzzle_count)
    session.add(subset)
    session.flush()
    return subset


_RUN = {"target_hours": 24, "break_after_hours": 0}
_BASE_CONFIG: dict[str, object] = {
    "puzzle_order": "fixed",
    "failed_repetition": {"mode": "none"},
}


def _make_schedule(session, user, subset, runs: list | None = None):  # type: ignore[misc]
    from app.models.schedule import Schedule
    # ScheduleConfig.from_dict requires at least one run; default to one.
    config = {**_BASE_CONFIG, "runs": runs if runs is not None else [_RUN]}
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Test schedule",
        config=config,
    )
    session.add(schedule)
    session.flush()
    return schedule


# ── Route: GET /schedules — filter tests ─────────────────────────────────────────

@pytest.mark.integration
class TestListSchedulesFilters:

    def test_run_count_gte(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_rc_gte")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        one_run = _make_schedule(db_session, user, subset, runs=[_RUN])
        three_runs = _make_schedule(db_session, user, subset, runs=[_RUN, _RUN, _RUN])

        resp = client.get("/schedules?runCount=gte&runCount=2")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert three_runs.id in ids
        assert one_run.id not in ids

    def test_run_count_lte(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_rc_lte")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        one_run = _make_schedule(db_session, user, subset, runs=[_RUN])
        three_runs = _make_schedule(db_session, user, subset, runs=[_RUN, _RUN, _RUN])

        resp = client.get("/schedules?runCount=lte&runCount=2")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert one_run.id in ids
        assert three_runs.id not in ids

    def test_puzzle_count_gte(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_pc_gte")
        _login(client, user.id)
        small_subset = _make_subset(db_session, user, puzzle_count=10)
        big_subset = _make_subset(db_session, user, puzzle_count=500)
        small_sched = _make_schedule(db_session, user, small_subset)
        big_sched = _make_schedule(db_session, user, big_subset)

        resp = client.get("/schedules?puzzleCount=gte&puzzleCount=100")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert big_sched.id in ids
        assert small_sched.id not in ids

    def test_puzzle_count_lte(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_pc_lte")
        _login(client, user.id)
        small_subset = _make_subset(db_session, user, puzzle_count=10)
        big_subset = _make_subset(db_session, user, puzzle_count=500)
        small_sched = _make_schedule(db_session, user, small_subset)
        big_sched = _make_schedule(db_session, user, big_subset)

        resp = client.get("/schedules?puzzleCount=lte&puzzleCount=50")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert small_sched.id in ids
        assert big_sched.id not in ids

    def test_puzzle_count_uses_locked_puzzle_count(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_pc_locked")
        _login(client, user.id)
        from app.models.subset import Subset
        # puzzle_count=10 but locked_puzzle_count=200 — filter should use locked value
        subset = Subset(
            user_id=user.id,
            name="locked subset",
            puzzle_count=10,
            locked_at=datetime.now(timezone.utc),
            locked_puzzle_count=200,
        )
        db_session.add(subset)
        db_session.flush()
        sched = _make_schedule(db_session, user, subset)

        resp = client.get("/schedules?puzzleCount=gte&puzzleCount=100")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert sched.id in ids

    def test_subset_ids_filter(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_ssid")
        _login(client, user.id)
        subset_a = _make_subset(db_session, user)
        subset_b = _make_subset(db_session, user)
        sched_a = _make_schedule(db_session, user, subset_a)
        sched_b = _make_schedule(db_session, user, subset_b)

        resp = client.get(f"/schedules?subsetId=is&subsetId={subset_a.id}")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert sched_a.id in ids
        assert sched_b.id not in ids

    def test_subset_puzzle_count_in_response(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_spc")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=42)
        sched = _make_schedule(db_session, user, subset)

        resp = client.get("/schedules")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        match = next(i for i in items if i["id"] == sched.id)
        assert match["subsetPuzzleCount"] == 42

    def test_subset_puzzle_count_uses_locked_value(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_spc_locked")
        _login(client, user.id)
        from app.models.subset import Subset
        subset = Subset(
            user_id=user.id,
            name="locked subset",
            puzzle_count=10,
            locked_at=datetime.now(timezone.utc),
            locked_puzzle_count=99,
        )
        db_session.add(subset)
        db_session.flush()
        sched = _make_schedule(db_session, user, subset)

        resp = client.get("/schedules")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        match = next(i for i in items if i["id"] == sched.id)
        assert match["subsetPuzzleCount"] == 99

    def test_date_after_excludes_older(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_date_after")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        old = _make_schedule(db_session, user, subset)
        old.created_at = datetime(2024, 1, 15, tzinfo=timezone.utc)
        recent = _make_schedule(db_session, user, subset)
        recent.created_at = datetime(2024, 3, 15, tzinfo=timezone.utc)
        db_session.flush()

        resp = client.get("/schedules?date=after&date=2024-02-01")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert recent.id in ids
        assert old.id not in ids

    def test_date_filter_uses_locked_at(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lsf_date_locked")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        sched = _make_schedule(db_session, user, subset)
        # Created Jan, locked Mar — effective date should be Mar
        sched.created_at = datetime(2024, 1, 15, tzinfo=timezone.utc)
        sched.locked_at = datetime(2024, 3, 15, tzinfo=timezone.utc)
        db_session.flush()

        resp = client.get("/schedules?date=after&date=2024-02-01")

        assert resp.status_code == 200
        ids = {item["id"] for item in resp.get_json()["items"]}
        assert sched.id in ids
