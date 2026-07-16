"""Integration tests for GET /runs/<id>/training-items — pagination and filter params."""
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from flask.testing import FlaskClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _make_schedule(session, user, *, total_queue: int = 2):  # type: ignore[misc]
    from app.models.subset import Subset
    from app.models.schedule import Schedule
    max_repeats = total_queue - 1
    rep_config = (
        {"mode": "queue", "max_repeats": max_repeats}
        if max_repeats > 0
        else {"mode": "none"}
    )
    subset = Subset(user_id=user.id, name="s", puzzle_count=5)
    session.add(subset)
    session.flush()
    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Test schedule",
        config={
            "runs": [{"target_hours": 168, "break_after_hours": 0}],
            "puzzle_order": "fixed",
            "failed_repetition": rep_config,
        },
    )
    session.add(schedule)
    session.flush()
    return schedule


def _make_run(session, user, schedule):  # type: ignore[misc]
    from app.models.training import Training
    from app.models.run import Run
    now = datetime.now(timezone.utc)
    training = Training(user_id=user.id, schedule_id=schedule.id, started_at=now)
    session.add(training)
    session.flush()
    run = Run(training_id=training.id, run_index=0, started_at=now)
    session.add(run)
    session.flush()
    return run


def _make_lichess_tactic(session, *, rating: int = 1500):  # type: ignore[misc]
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic
    item = TrainingItem(source_type=TrainingItemSource.LICHESS_TACTIC)
    session.add(item)
    session.flush()
    tactic = LichessTactic(
        training_item_id=item.id,
        puzzle_id=f"puzzle_{item.id}",
        fen="4k3/1Q5R/8/8/3K4/8/8/R7 b - - 0 1",
        moves="e8d8 a1a8",
        rating=rating,
        rating_deviation=80,
        popularity=90,
        nb_plays=100,
        game_url="https://lichess.org/test",
    )
    session.add(tactic)
    session.flush()
    return item


def _get_or_create_difficulty(session, *, value: int, min_rating: int | None, max_rating: int | None):  # type: ignore[misc]
    from app.models.scraped_positional_difficulty import ScrapedPositionalDifficulty
    existing = session.execute(
        sa.select(ScrapedPositionalDifficulty).where(ScrapedPositionalDifficulty.value == value)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    difficulty = ScrapedPositionalDifficulty(
        value=value,
        label=f"Level {value}",
        description=f"Difficulty level {value}",
        min_rating=min_rating,
        max_rating=max_rating,
    )
    session.add(difficulty)
    session.flush()
    return difficulty


def _make_scraped_positional(session, *, min_rating: int | None = 1600, max_rating: int | None = 1800):  # type: ignore[misc]
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle
    difficulty = _get_or_create_difficulty(
        session, value=min_rating or 9999, min_rating=min_rating, max_rating=max_rating
    )
    item = TrainingItem(source_type=TrainingItemSource.SCRAPED_POSITIONAL)
    session.add(item)
    session.flush()
    puzzle = ScrapedPositionalPuzzle(
        training_item_id=item.id,
        internal_id=item.id,
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves="e2e4",
        lichess_url=f"https://lichess.org/analysis/{item.id}",
        difficulty_id=difficulty.id,
    )
    session.add(puzzle)
    session.flush()
    return item


def _add_run_item(session, run, training_item, *, position: int):  # type: ignore[misc]
    from app.models.run import RunTrainingItem
    rp = RunTrainingItem(
        run_id=run.id,
        training_item_id=training_item.id,
        position=position,
    )
    session.add(rp)
    session.flush()
    return rp


def _add_attempt(  # type: ignore[misc]
    session,
    run_training_item,
    *,
    try_number: int,
    status: str,
    time_spent_ms: int | None = None,
):
    from app.models.run import TrainingAttempt
    now = datetime.now(timezone.utc)
    attempt = TrainingAttempt(
        run_training_item_id=run_training_item.id,
        try_number=try_number,
        status=status,
        started_at=now,
        completed_at=now if status != "in_progress" else None,
        time_spent_ms=time_spent_ms,
        moves=[],
    )
    session.add(attempt)
    session.flush()
    return attempt


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestRunTrainingItemsFilters:

    def test_response_shape(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_shape")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        item = _make_lichess_tactic(db_session)
        _add_run_item(db_session, run, item, position=0)

        resp = client.get(f"/runs/{run.id}/training-items")

        assert resp.status_code == 200
        data = resp.get_json()
        assert "items" in data
        assert "total" in data
        assert "maxTriesPerItem" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        assert data["total"] == 1

    def test_pagination(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_pg")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        for i in range(5):
            item = _make_lichess_tactic(db_session)
            _add_run_item(db_session, run, item, position=i)

        resp1 = client.get(f"/runs/{run.id}/training-items?pageSize=3&page=1")
        resp2 = client.get(f"/runs/{run.id}/training-items?pageSize=3&page=2")

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        data1 = resp1.get_json()
        data2 = resp2.get_json()
        assert data1["total"] == 5
        assert len(data1["items"]) == 3
        assert len(data2["items"]) == 2
        ids1 = {i["runTrainingItemId"] for i in data1["items"]}
        ids2 = {i["runTrainingItemId"] for i in data2["items"]}
        assert ids1.isdisjoint(ids2)

    # ── sourceType filter ────────────────────────────────────────────────────

    def test_source_type_filter_includes(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_stf_inc")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        tactic = _make_lichess_tactic(db_session)
        positional = _make_scraped_positional(db_session, min_rating=1600, max_rating=1800)
        rp_tactic = _add_run_item(db_session, run, tactic, position=0)
        rp_positional = _add_run_item(db_session, run, positional, position=1)

        resp = client.get(f"/runs/{run.id}/training-items?sourceType=is&sourceType=LICHESS_TACTIC")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 1
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_tactic.id in ids
        assert rp_positional.id not in ids

    def test_source_type_filter_excludes(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_stf_exc")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        tactic = _make_lichess_tactic(db_session)
        positional = _make_scraped_positional(db_session, min_rating=1700, max_rating=1900)
        rp_tactic = _add_run_item(db_session, run, tactic, position=0)
        rp_positional = _add_run_item(db_session, run, positional, position=1)

        resp = client.get(f"/runs/{run.id}/training-items?sourceType=is_not&sourceType=LICHESS_TACTIC")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 1
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_tactic.id not in ids
        assert rp_positional.id in ids

    # ── positionStatus filter ────────────────────────────────────────────────
    # Each test verifies one status value and that filtering excludes the others.

    def test_position_status_not_started(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_ps_ns")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        item_ns = _make_lichess_tactic(db_session)
        item_ip = _make_lichess_tactic(db_session)
        rp_ns = _add_run_item(db_session, run, item_ns, position=0)
        rp_ip = _add_run_item(db_session, run, item_ip, position=1)
        _add_attempt(db_session, rp_ip, try_number=1, status="in_progress")

        resp = client.get(f"/runs/{run.id}/training-items?positionStatus=is&positionStatus=not_started")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_ns.id in ids
        assert rp_ip.id not in ids

    def test_position_status_in_progress(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_ps_ip")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        item_ip = _make_lichess_tactic(db_session)
        item_ns = _make_lichess_tactic(db_session)
        rp_ip = _add_run_item(db_session, run, item_ip, position=0)
        rp_ns = _add_run_item(db_session, run, item_ns, position=1)
        _add_attempt(db_session, rp_ip, try_number=1, status="in_progress")

        resp = client.get(f"/runs/{run.id}/training-items?positionStatus=is&positionStatus=in_progress")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_ip.id in ids
        assert rp_ns.id not in ids

    def test_position_status_solved(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_ps_sol")
        _login(client, user.id)
        # total_queue=2: first solve attempt counts as "solved" when try_number=1
        schedule = _make_schedule(db_session, user, total_queue=2)
        run = _make_run(db_session, user, schedule)
        item_solved = _make_lichess_tactic(db_session)
        item_retries = _make_lichess_tactic(db_session)
        rp_solved = _add_run_item(db_session, run, item_solved, position=0)
        rp_retries = _add_run_item(db_session, run, item_retries, position=1)
        # Solved on first try
        _add_attempt(db_session, rp_solved, try_number=1, status="solved", time_spent_ms=8000)
        # Solved on second try (solved_with_retries)
        _add_attempt(db_session, rp_retries, try_number=1, status="failed")
        _add_attempt(db_session, rp_retries, try_number=2, status="solved", time_spent_ms=12000)

        resp = client.get(f"/runs/{run.id}/training-items?positionStatus=is&positionStatus=solved")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_solved.id in ids
        assert rp_retries.id not in ids

    def test_position_status_solved_with_retries(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_ps_swr")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user, total_queue=2)
        run = _make_run(db_session, user, schedule)
        item_swr = _make_lichess_tactic(db_session)
        item_solved = _make_lichess_tactic(db_session)
        rp_swr = _add_run_item(db_session, run, item_swr, position=0)
        rp_solved = _add_run_item(db_session, run, item_solved, position=1)
        _add_attempt(db_session, rp_swr, try_number=1, status="failed")
        _add_attempt(db_session, rp_swr, try_number=2, status="solved")
        _add_attempt(db_session, rp_solved, try_number=1, status="solved")

        resp = client.get(f"/runs/{run.id}/training-items?positionStatus=is&positionStatus=solved_with_retries")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_swr.id in ids
        assert rp_solved.id not in ids

    def test_position_status_failed(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_ps_fail")
        _login(client, user.id)
        # total_queue=2: two failed attempts exhaust the queue → "failed"
        schedule = _make_schedule(db_session, user, total_queue=2)
        run = _make_run(db_session, user, schedule)
        item_failed = _make_lichess_tactic(db_session)
        item_ip = _make_lichess_tactic(db_session)
        rp_failed = _add_run_item(db_session, run, item_failed, position=0)
        rp_ip = _add_run_item(db_session, run, item_ip, position=1)
        _add_attempt(db_session, rp_failed, try_number=1, status="failed")
        _add_attempt(db_session, rp_failed, try_number=2, status="failed")
        _add_attempt(db_session, rp_ip, try_number=1, status="in_progress")

        resp = client.get(f"/runs/{run.id}/training-items?positionStatus=is&positionStatus=failed")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_failed.id in ids
        assert rp_ip.id not in ids

    # ── timeMs filter ────────────────────────────────────────────────────────

    def test_time_ms_filter_gte(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_tms_gte")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user, total_queue=1)
        run = _make_run(db_session, user, schedule)
        item_fast = _make_lichess_tactic(db_session)
        item_slow = _make_lichess_tactic(db_session)
        rp_fast = _add_run_item(db_session, run, item_fast, position=0)
        rp_slow = _add_run_item(db_session, run, item_slow, position=1)
        _add_attempt(db_session, rp_fast, try_number=1, status="solved", time_spent_ms=3000)
        _add_attempt(db_session, rp_slow, try_number=1, status="solved", time_spent_ms=10000)

        resp = client.get(f"/runs/{run.id}/training-items?timeMs=gte&timeMs=5000")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_slow.id in ids
        assert rp_fast.id not in ids

    def test_time_ms_filter_not_set(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_tms_ns")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user, total_queue=1)
        run = _make_run(db_session, user, schedule)
        item_timed = _make_lichess_tactic(db_session)
        item_no_time = _make_lichess_tactic(db_session)
        rp_timed = _add_run_item(db_session, run, item_timed, position=0)
        rp_no_time = _add_run_item(db_session, run, item_no_time, position=1)
        _add_attempt(db_session, rp_timed, try_number=1, status="solved", time_spent_ms=5000)
        _add_attempt(db_session, rp_no_time, try_number=1, status="solved", time_spent_ms=None)

        resp = client.get(f"/runs/{run.id}/training-items?timeMs=not_set")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_no_time.id in ids
        assert rp_timed.id not in ids

    # ── rating filter ────────────────────────────────────────────────────────

    def test_rating_filter_gte_lichess_tactic(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_rat_gte")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        item_low = _make_lichess_tactic(db_session, rating=1200)
        item_high = _make_lichess_tactic(db_session, rating=1800)
        rp_low = _add_run_item(db_session, run, item_low, position=0)
        rp_high = _add_run_item(db_session, run, item_high, position=1)

        resp = client.get(f"/runs/{run.id}/training-items?rating=gte&rating=1500")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_high.id in ids
        assert rp_low.id not in ids

    def test_rating_filter_gte_scraped_positional(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_rat_sp")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        item_low = _make_scraped_positional(db_session, min_rating=1200, max_rating=1400)
        item_high = _make_scraped_positional(db_session, min_rating=1800, max_rating=2000)
        rp_low = _add_run_item(db_session, run, item_low, position=0)
        rp_high = _add_run_item(db_session, run, item_high, position=1)

        resp = client.get(f"/runs/{run.id}/training-items?rating=gte&rating=1600")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_high.id in ids
        assert rp_low.id not in ids

    def test_rating_filter_between(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rti_rat_btwn")
        _login(client, user.id)
        schedule = _make_schedule(db_session, user)
        run = _make_run(db_session, user, schedule)
        item_low = _make_lichess_tactic(db_session, rating=1100)
        item_mid = _make_lichess_tactic(db_session, rating=1500)
        item_high = _make_lichess_tactic(db_session, rating=1900)
        rp_low = _add_run_item(db_session, run, item_low, position=0)
        rp_mid = _add_run_item(db_session, run, item_mid, position=1)
        rp_high = _add_run_item(db_session, run, item_high, position=2)

        resp = client.get(f"/runs/{run.id}/training-items?rating=between&rating=1300&rating=1700")

        assert resp.status_code == 200
        data = resp.get_json()
        ids = {i["runTrainingItemId"] for i in data["items"]}
        assert rp_mid.id in ids
        assert rp_low.id not in ids
        assert rp_high.id not in ids
