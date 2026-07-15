"""Integration tests for GET /leaderboard and GET /leaderboard/weekly filter params."""
from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient


# ── Helpers ───────────────────────────────────────────────────────────────────

def _login(client: FlaskClient, user_id: int) -> None:
    with client.session_transaction() as sess:
        sess["user_id"] = user_id


def _make_user(session, username: str, display_name: str | None = None):  # type: ignore[misc]
    from app.models.user import User
    user = User(
        lichess_username=username,
        display_name=display_name or username,
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()
    return user


def _make_schedule(session, user, name: str = "Test schedule"):  # type: ignore[misc]
    from app.models.subset import Subset
    from app.models.schedule import Schedule
    subset = Subset(user_id=user.id, name="s", puzzle_count=5)
    session.add(subset)
    session.flush()
    _BASE = {"puzzle_order": "fixed", "failed_repetition": {"mode": "none"}}
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name=name,
        config={**_BASE, "runs": [{"target_hours": 24, "break_after_hours": 0}]},
    )
    session.add(schedule)
    session.flush()
    return schedule


def _make_run(  # type: ignore[misc]
    session,
    user,
    schedule,
    *,
    run_index: int = 0,
    completed: bool = False,
    aborted: bool = False,
):
    from app.models.training import Training
    from app.models.run import Run
    now = datetime.now(timezone.utc)
    training = Training(user_id=user.id, schedule_id=schedule.id, started_at=now)
    session.add(training)
    session.flush()
    run = Run(
        training_id=training.id,
        run_index=run_index,
        started_at=now,
        completed_at=now if completed else None,
        aborted_at=now if aborted else None,
    )
    session.add(run)
    session.flush()
    return run


# ── /leaderboard filters ──────────────────────────────────────────────────────

@pytest.mark.integration
class TestLeaderboardRunFilters:

    def test_response_shape(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lb_shape")
        _login(client, user.id)

        resp = client.get("/leaderboard")

        assert resp.status_code == 200
        data = resp.get_json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_user_filter_includes(self, client: FlaskClient, db_session) -> None:
        alice = _make_user(db_session, "lb_uf_alice", "Alice")
        bob = _make_user(db_session, "lb_uf_bob", "Bob")
        _login(client, alice.id)
        sched_a = _make_schedule(db_session, alice)
        sched_b = _make_schedule(db_session, bob)
        _make_run(db_session, alice, sched_a)
        _make_run(db_session, bob, sched_b)

        resp = client.get(f"/leaderboard?userId=is&userId={alice.id}")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        user_ids = {i["userId"] for i in items}
        assert alice.id in user_ids
        assert bob.id not in user_ids

    def test_user_filter_excludes(self, client: FlaskClient, db_session) -> None:
        alice = _make_user(db_session, "lb_uf_ex_alice", "Alice")
        bob = _make_user(db_session, "lb_uf_ex_bob", "Bob")
        _login(client, alice.id)
        sched_a = _make_schedule(db_session, alice)
        sched_b = _make_schedule(db_session, bob)
        _make_run(db_session, alice, sched_a)
        _make_run(db_session, bob, sched_b)

        resp = client.get(f"/leaderboard?userId=is_not&userId={alice.id}")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        user_ids = {i["userId"] for i in items}
        assert alice.id not in user_ids
        assert bob.id in user_ids

    def test_status_filter_active(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lb_sf_active")
        _login(client, user.id)
        sched = _make_schedule(db_session, user)
        active_run = _make_run(db_session, user, sched, run_index=0)
        _make_run(db_session, user, sched, run_index=1, completed=True)
        _make_run(db_session, user, sched, run_index=2, aborted=True)

        resp = client.get("/leaderboard?status=is&status=active")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        run_ids = {i["runId"] for i in items}
        assert active_run.id in run_ids
        assert all(i["status"] == "active" for i in items if i["runId"] in run_ids)

    def test_status_filter_completed(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lb_sf_completed")
        _login(client, user.id)
        sched = _make_schedule(db_session, user)
        _make_run(db_session, user, sched, run_index=0)
        completed_run = _make_run(db_session, user, sched, run_index=1, completed=True)

        resp = client.get("/leaderboard?status=is&status=completed")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        run_ids = {i["runId"] for i in items}
        assert completed_run.id in run_ids
        assert all(i["status"] == "completed" for i in items if i["runId"] in run_ids)

    def test_status_filter_aborted(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lb_sf_aborted")
        _login(client, user.id)
        sched = _make_schedule(db_session, user)
        _make_run(db_session, user, sched, run_index=0)
        aborted_run = _make_run(db_session, user, sched, run_index=1, aborted=True)

        resp = client.get("/leaderboard?status=is&status=aborted")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        run_ids = {i["runId"] for i in items}
        assert aborted_run.id in run_ids
        assert all(i["status"] == "aborted" for i in items if i["runId"] in run_ids)

    def test_search_by_display_name(self, client: FlaskClient, db_session) -> None:
        alice = _make_user(db_session, "lb_srch_dn_alice", "AliceUnique")
        bob = _make_user(db_session, "lb_srch_dn_bob", "BobUnique")
        _login(client, alice.id)
        sched_a = _make_schedule(db_session, alice, name="Sched X")
        sched_b = _make_schedule(db_session, bob, name="Sched Y")
        _make_run(db_session, alice, sched_a)
        _make_run(db_session, bob, sched_b)

        resp = client.get("/leaderboard?q=AliceUniq")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        user_ids = {i["userId"] for i in items}
        assert alice.id in user_ids
        assert bob.id not in user_ids

    def test_search_by_schedule_name(self, client: FlaskClient, db_session) -> None:
        alice = _make_user(db_session, "lb_srch_sn_alice", "Alice S")
        bob = _make_user(db_session, "lb_srch_sn_bob", "Bob S")
        _login(client, alice.id)
        sched_a = _make_schedule(db_session, alice, name="AlphaScheduleUnique")
        sched_b = _make_schedule(db_session, bob, name="BetaScheduleUnique")
        _make_run(db_session, alice, sched_a)
        _make_run(db_session, bob, sched_b)

        resp = client.get("/leaderboard?q=AlphaSched")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        schedule_names = {i["scheduleName"] for i in items}
        assert "AlphaScheduleUnique" in schedule_names
        assert "BetaScheduleUnique" not in schedule_names

    def test_pagination(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lb_pg")
        _login(client, user.id)
        sched = _make_schedule(db_session, user)
        for i in range(3):
            _make_run(db_session, user, sched, run_index=i)

        resp1 = client.get("/leaderboard?pageSize=2&page=1")
        resp2 = client.get("/leaderboard?pageSize=2&page=2")

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        data1 = resp1.get_json()
        data2 = resp2.get_json()
        assert data1["total"] >= 3
        assert len(data1["items"]) == 2
        assert len(data2["items"]) >= 1
        # No overlap
        ids1 = {i["runId"] for i in data1["items"]}
        ids2 = {i["runId"] for i in data2["items"]}
        assert ids1.isdisjoint(ids2)


# ── /leaderboard/weekly filters ───────────────────────────────────────────────

@pytest.mark.integration
class TestLeaderboardWeeklyFilters:

    def test_response_shape(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "lbw_shape")
        _login(client, user.id)

        resp = client.get("/leaderboard/weekly")

        assert resp.status_code == 200
        data = resp.get_json()
        assert "items" in data
        assert "total" in data

    def test_user_filter(self, client: FlaskClient, db_session) -> None:
        alice = _make_user(db_session, "lbw_uf_alice", "Alice W")
        bob = _make_user(db_session, "lbw_uf_bob", "Bob W")
        _login(client, alice.id)
        sched_a = _make_schedule(db_session, alice)
        sched_b = _make_schedule(db_session, bob)
        # Non-aborted runs make users appear as active_users in the weekly board
        _make_run(db_session, alice, sched_a)
        _make_run(db_session, bob, sched_b)

        resp = client.get(f"/leaderboard/weekly?userId=is&userId={alice.id}")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        user_ids = {i["userId"] for i in items}
        assert alice.id in user_ids
        assert bob.id not in user_ids

    def test_search_by_display_name(self, client: FlaskClient, db_session) -> None:
        alice = _make_user(db_session, "lbw_srch_alice", "AliceWeeklyUnique")
        bob = _make_user(db_session, "lbw_srch_bob", "BobWeeklyUnique")
        _login(client, alice.id)
        sched_a = _make_schedule(db_session, alice)
        sched_b = _make_schedule(db_session, bob)
        _make_run(db_session, alice, sched_a)
        _make_run(db_session, bob, sched_b)

        resp = client.get("/leaderboard/weekly?q=AliceWeekly")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        user_ids = {i["userId"] for i in items}
        assert alice.id in user_ids
        assert bob.id not in user_ids
