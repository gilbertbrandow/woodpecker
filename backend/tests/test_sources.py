from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(session):  # type: ignore[misc]
    from app.models.user import User

    user = User(lichess_username="sources_test_user", display_name="sources_test_user", created_at=datetime.now(timezone.utc))
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


def _make_metadata_row(session, run, *, theme_counts_json=None, rating_bucket_counts_json=None):  # type: ignore[misc]
    from app.models.source_import_run import LichessTacticsSourceRunMetadata

    row = LichessTacticsSourceRunMetadata(
        source_import_run_id=run.id,
        imported_count=100,
        total_tactics_after_run=100,
        tactics_with_themes_count=80,
        tactics_with_openings_count=60,
        min_rating=400,
        max_rating=2800,
        average_rating=1500,
        rating_bucket_counts_json=rating_bucket_counts_json or {"1500": 100},
        theme_counts_json=theme_counts_json or {"fork": 40, "pin": 30},
        opening_counts_json={"Sicilian_Defense": 20},
        generated_at=datetime.now(timezone.utc),
    )
    session.add(row)
    session.flush()
    return row


# ── Auth protection ────────────────────────────────────────────────────────────

class TestSourcesAuthProtection:
    def test_list_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/").status_code == 401

    def test_items_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/items").status_code == 401

    def test_source_run_metadata_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/source-run-metadata").status_code == 401


# ── Sources list ───────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestSourcesList:
    def test_always_returns_all_three_sources(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/").get_json()

        assert len(body["sources"]) == 3
        source_types = {s["sourceType"] for s in body["sources"]}
        assert source_types == {"LICHESS_TACTIC", "SCRAPED_POSITIONAL", "DECOY"}

    def test_nulls_when_no_import_runs(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/").get_json()

        for source in body["sources"]:
            assert source["firstImported"] is None
            assert source["lastSynced"] is None
            assert source["puzzleCount"] == 0

    def test_puzzle_count_reflects_training_items(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_tactic(db_session, "lst001", source_run=run)
        _make_tactic(db_session, "lst002", source_run=run)

        body = client.get("/sources/").get_json()

        lichess = next(s for s in body["sources"] if s["sourceType"] == "LICHESS_TACTIC")
        assert lichess["puzzleCount"] == 2

    def test_first_imported_is_earliest_started_at(self, client: FlaskClient, db_session) -> None:
        from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

        _login(client, _make_user(db_session).id)
        early = datetime(2024, 1, 1, tzinfo=timezone.utc)
        late = datetime(2024, 6, 1, tzinfo=timezone.utc)

        for started_at in (late, early):
            run = SourceImportRun(
                source=SourceImportSource.LICHESS_TACTICS,
                operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
                status=SourceImportStatus.SUCCEEDED,
                started_at=started_at,
                finished_at=started_at,
            )
            db_session.add(run)
        db_session.flush()

        body = client.get("/sources/").get_json()

        lichess = next(s for s in body["sources"] if s["sourceType"] == "LICHESS_TACTIC")
        assert lichess["firstImported"].startswith("2024-01-01")

    def test_last_synced_ignores_failed_runs(self, client: FlaskClient, db_session) -> None:
        from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

        _login(client, _make_user(db_session).id)
        succeeded_at = datetime(2024, 3, 1, tzinfo=timezone.utc)
        failed_at = datetime(2024, 9, 1, tzinfo=timezone.utc)

        db_session.add(SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.SUCCEEDED,
            started_at=succeeded_at,
            finished_at=succeeded_at,
        ))
        db_session.add(SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.FAILED,
            started_at=failed_at,
            finished_at=failed_at,
        ))
        db_session.flush()

        body = client.get("/sources/").get_json()

        lichess = next(s for s in body["sources"] if s["sourceType"] == "LICHESS_TACTIC")
        assert lichess["lastSynced"].startswith("2024-03-01")

    def test_last_synced_null_when_only_failed_runs(self, client: FlaskClient, db_session) -> None:
        from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

        _login(client, _make_user(db_session).id)
        db_session.add(SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.FAILED,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        ))
        db_session.flush()

        body = client.get("/sources/").get_json()

        lichess = next(s for s in body["sources"] if s["sourceType"] == "LICHESS_TACTIC")
        assert lichess["lastSynced"] is None
        assert lichess["firstImported"] is not None


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


# ── Source run metadata ────────────────────────────────────────────────────────

@pytest.mark.integration
class TestLichessTacticsSourceRunMetadata:
    def test_returns_null_when_no_succeeded_runs(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/lichess-tactics/source-run-metadata").get_json()

        assert body == {"metadata": None}

    def test_returns_metadata_shape_with_succeeded_run(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_metadata_row(db_session, run)

        metadata = client.get("/sources/lichess-tactics/source-run-metadata").get_json()["metadata"]

        assert metadata is not None
        for key in (
            "latestSourceImportRunId", "importedCount", "totalTacticsAfterRun",
            "tacticsWithThemesCount", "tacticsWithOpeningsCount",
            "minRating", "maxRating", "ratingBucketCounts", "themes", "generatedAt",
        ):
            assert key in metadata, f"missing key: {key}"

    def test_themes_enriched_with_display_name(self, client: FlaskClient, db_session) -> None:
        from app.models.lichess_tactic_theme import LichessTacticTheme

        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)

        theme = LichessTacticTheme(
            name="test_theme_enrichment_unique",
            display_name="Test Theme",
            description="A test tactical motif.",
        )
        db_session.add(theme)
        db_session.flush()

        _make_metadata_row(db_session, run, theme_counts_json={"test_theme_enrichment_unique": 50})

        metadata = client.get("/sources/lichess-tactics/source-run-metadata").get_json()["metadata"]

        themes = metadata["themes"]
        assert len(themes) == 1
        assert themes[0]["name"] == "test_theme_enrichment_unique"
        assert themes[0]["displayName"] == "Test Theme"
        assert themes[0]["description"] == "A test tactical motif."
        assert themes[0]["count"] == 50

    def test_themes_sorted_by_count_descending(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_metadata_row(db_session, run, theme_counts_json={"pin": 10, "fork": 50, "skewer": 30})

        themes = client.get("/sources/lichess-tactics/source-run-metadata").get_json()["metadata"]["themes"]

        counts = [t["count"] for t in themes]
        assert counts == sorted(counts, reverse=True)

    def test_themes_capped_at_top_limit(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        # 30 themes — more than TOP_THEMES_LIMIT (25)
        theme_counts = {f"theme_{i:02d}": i + 1 for i in range(30)}
        _make_metadata_row(db_session, run, theme_counts_json=theme_counts)

        themes = client.get("/sources/lichess-tactics/source-run-metadata").get_json()["metadata"]["themes"]

        assert len(themes) == 25

    def test_returns_null_for_failed_run(self, client: FlaskClient, db_session) -> None:
        from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

        _login(client, _make_user(db_session).id)
        failed_run = SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.FAILED,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db_session.add(failed_run)
        db_session.flush()

        body = client.get("/sources/lichess-tactics/source-run-metadata").get_json()

        assert body == {"metadata": None}
