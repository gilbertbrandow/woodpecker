from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(session):  # type: ignore[misc]
    from app.models.user import User

    user = User(lichess_username="sources_test_user", created_at=datetime.now(timezone.utc))
    session.add(user)
    session.flush()
    return user


def _login(client: FlaskClient, user_id: int) -> None:
    with client.session_transaction() as sess:
        sess["user_id"] = user_id


def _make_source_run(session):  # type: ignore[misc]
    from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

    run = SourceImportRun(
        source=SourceImportSource.LICHESS_TACTICS,
        operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
        status=SourceImportStatus.SUCCEEDED,
        started_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
    )
    session.add(run)
    session.flush()
    return run


def _make_tactic(session, puzzle_id: str, rating: int = 1500, source_run=None):  # type: ignore[misc]
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic

    if source_run is None:
        source_run = _make_source_run(session)

    item = TrainingItem(
        source_type=TrainingItemSource.LICHESS_TACTIC,
        source_import_run_id=source_run.id,
    )
    session.add(item)
    session.flush()

    tactic = LichessTactic(
        training_item_id=item.id,
        puzzle_id=puzzle_id,
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves="e2e4 e7e5",
        rating=rating,
        rating_deviation=100,
        popularity=80,
        nb_plays=50,
        game_url=f"https://lichess.org/{puzzle_id}",
    )
    session.add(tactic)
    session.flush()
    return tactic


# ── Auth protection ────────────────────────────────────────────────────────────

class TestSourcesAuthProtection:
    def test_stats_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/stats").status_code == 401

    def test_rating_distribution_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/rating-distribution").status_code == 401

    def test_top_themes_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/top-themes").status_code == 401

    def test_items_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/items").status_code == 401


# ── Stats ──────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestLichessTacticsStats:
    def test_empty_database_returns_zero_counts(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/lichess-tactics/stats").get_json()

        assert body["totalCount"] == 0
        assert body["withOpeningsCount"] == 0
        assert body["withOpeningsPct"] == 0.0

    def test_returns_correct_total_count(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_tactic(db_session, "st001", 1400, source_run=run)
        _make_tactic(db_session, "st002", 1600, source_run=run)

        body = client.get("/sources/lichess-tactics/stats").get_json()

        assert body["totalCount"] == 2

    def test_response_contains_required_keys(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/lichess-tactics/stats").get_json()

        assert {"totalCount", "withOpeningsCount", "withOpeningsPct"}.issubset(body.keys())


# ── Rating distribution ────────────────────────────────────────────────────────

@pytest.mark.integration
class TestLichessTacticsRatingDistribution:
    def test_empty_database_returns_empty_buckets(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/lichess-tactics/rating-distribution").get_json()

        assert body == {"buckets": []}

    def test_tactics_appear_in_correct_bucket(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_tactic(db_session, "rd001", 1500, source_run=run)
        _make_tactic(db_session, "rd002", 1510, source_run=run)

        buckets = client.get("/sources/lichess-tactics/rating-distribution").get_json()["buckets"]

        total = sum(b["count"] for b in buckets)
        assert total == 2

    def test_buckets_have_correct_shape(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        _make_tactic(db_session, "rd003", 1500)

        buckets = client.get("/sources/lichess-tactics/rating-distribution").get_json()["buckets"]

        assert len(buckets) >= 1
        for b in buckets:
            assert "min" in b and "max" in b and "count" in b
            assert b["max"] - b["min"] == 50


# ── Items list ─────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestLichessTacticsItems:
    def test_returns_all_tactics(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_tactic(db_session, "it001", 1300, source_run=run)
        _make_tactic(db_session, "it002", 1700, source_run=run)

        body = client.get("/sources/lichess-tactics/items").get_json()

        assert body["total"] == 2
        assert body["page"] == 1
        assert len(body["puzzles"]) == 2

    def test_rating_min_filter(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_tactic(db_session, "it003", 1000, source_run=run)
        _make_tactic(db_session, "it004", 2000, source_run=run)

        body = client.get("/sources/lichess-tactics/items?ratingMin=1500").get_json()

        assert body["total"] == 1
        assert body["puzzles"][0]["puzzleId"] == "it004"

    def test_rating_max_filter(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_tactic(db_session, "it005", 1000, source_run=run)
        _make_tactic(db_session, "it006", 2000, source_run=run)

        body = client.get("/sources/lichess-tactics/items?ratingMax=1500").get_json()

        assert body["total"] == 1
        assert body["puzzles"][0]["puzzleId"] == "it005"

    def test_no_results_returns_empty_list(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        _make_tactic(db_session, "it007", 1500)

        body = client.get("/sources/lichess-tactics/items?ratingMin=9999").get_json()

        assert body["total"] == 0
        assert body["puzzles"] == []
        assert body["totalPages"] == 1

    def test_puzzle_response_shape(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        _make_tactic(db_session, "it008", 1500)

        puzzle = client.get("/sources/lichess-tactics/items").get_json()["puzzles"][0]

        assert {"puzzleId", "rating", "popularity", "nbPlays", "gameUrl", "themes", "openings"}.issubset(puzzle.keys())
