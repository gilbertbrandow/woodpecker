from datetime import datetime, timezone

import pytest
from flask.testing import FlaskClient
from sqlalchemy.exc import IntegrityError


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_source_run(session, status=None, finished_at=None):  # type: ignore[misc]
    from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

    if status is None:
        status = SourceImportStatus.SUCCEEDED
    now = datetime.now(timezone.utc)
    run = SourceImportRun(
        source=SourceImportSource.LICHESS_TACTICS,
        operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
        status=status,
        started_at=now,
        finished_at=finished_at if finished_at is not None else now,
    )
    session.add(run)
    session.flush()
    return run


def _make_metadata(session, run):  # type: ignore[misc]
    from app.models.source_import_run import LichessTacticsSourceRunMetadata

    meta = LichessTacticsSourceRunMetadata(
        source_import_run_id=run.id,
        imported_count=900,
        total_tactics_after_run=900,
        tactics_with_themes_count=850,
        tactics_with_openings_count=700,
        min_rating=600,
        max_rating=2800,
        average_rating=1500,
        rating_bucket_counts_json={"1500": 100, "1550": 120},
        theme_counts_json={"mateIn1": 500, "fork": 200},
        opening_counts_json={"Sicilian_Defense": 300, "French_Defense": 150},
        generated_at=datetime.now(timezone.utc),
    )
    session.add(meta)
    session.flush()
    return meta


def _make_user(session):  # type: ignore[misc]
    from app.models.user import User

    user = User(lichess_username="sir_meta_test", created_at=datetime.now(timezone.utc))
    session.add(user)
    session.flush()
    return user


def _login(client: FlaskClient, user_id: int) -> None:
    with client.session_transaction() as sess:
        sess["user_id"] = user_id


# ── Unit: model persistence ────────────────────────────────────────────────────

class TestSourceImportRunModel:
    def test_can_persist_running_run(self, db_session) -> None:
        from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportOperation, SourceImportStatus

        run = SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        db_session.add(run)
        db_session.flush()
        assert run.id is not None
        assert run.finished_at is None
        assert run.error_message is None

    def test_status_can_be_updated_to_succeeded(self, db_session) -> None:
        from app.models.source_import_run import SourceImportStatus

        run = _make_source_run(db_session, status=SourceImportStatus.RUNNING, finished_at=None)
        run.status = SourceImportStatus.SUCCEEDED
        run.finished_at = datetime.now(timezone.utc)
        db_session.flush()
        assert run.status == SourceImportStatus.SUCCEEDED
        assert run.finished_at is not None

    def test_metadata_row_relationship_is_accessible(self, db_session) -> None:
        run = _make_source_run(db_session)
        meta = _make_metadata(db_session, run)
        db_session.expire(run)
        assert run.metadata_row is not None
        assert run.metadata_row.id == meta.id

    def test_metadata_unique_constraint_raises_on_duplicate(self, db_session) -> None:
        run = _make_source_run(db_session)
        _make_metadata(db_session, run)
        db_session.commit()

        from app.models.source_import_run import LichessTacticsSourceRunMetadata

        duplicate = LichessTacticsSourceRunMetadata(
            source_import_run_id=run.id,
            imported_count=10,
            total_tactics_after_run=10,
            tactics_with_themes_count=5,
            tactics_with_openings_count=3,
            min_rating=1000,
            max_rating=2000,
            average_rating=1500,
            rating_bucket_counts_json={},
            theme_counts_json={},
            opening_counts_json={},
            generated_at=datetime.now(timezone.utc),
        )
        db_session.add(duplicate)
        with pytest.raises(IntegrityError):
            db_session.flush()
        # Rollback required to restore session to a usable state after the expected error
        db_session.rollback()


# ── Integration: get_latest_source_run_metadata() ─────────────────────────────

@pytest.mark.integration
class TestGetLatestSourceRunMetadata:
    def test_returns_none_when_no_runs_exist(self, db_session) -> None:
        from app.services.lichess_tactics_source import get_latest_source_run_metadata

        result = get_latest_source_run_metadata()
        assert result is None

    def test_returns_none_when_only_running_run_exists(self, db_session) -> None:
        from app.models.source_import_run import SourceImportStatus
        from app.services.lichess_tactics_source import get_latest_source_run_metadata

        run = _make_source_run(db_session, status=SourceImportStatus.RUNNING, finished_at=None)
        _make_metadata(db_session, run)
        db_session.commit()

        result = get_latest_source_run_metadata()
        assert result is None

    def test_returns_none_when_only_failed_run_exists(self, db_session) -> None:
        from app.models.source_import_run import SourceImportStatus
        from app.services.lichess_tactics_source import get_latest_source_run_metadata

        _make_source_run(db_session, status=SourceImportStatus.FAILED)
        db_session.commit()

        result = get_latest_source_run_metadata()
        assert result is None

    def test_returns_metadata_for_succeeded_run(self, db_session) -> None:
        from app.services.lichess_tactics_source import get_latest_source_run_metadata

        run = _make_source_run(db_session)
        _make_metadata(db_session, run)
        db_session.commit()

        result = get_latest_source_run_metadata()
        assert result is not None
        assert result["latestSourceImportRunId"] == run.id
        assert result["importedCount"] == 900
        assert result["totalTacticsAfterRun"] == 900
        assert result["minRating"] == 600
        assert result["maxRating"] == 2800
        assert result["averageRating"] == 1500
        assert "ratingBucketCounts" in result
        assert "themeCounts" in result
        assert "openingCounts" in result
        assert "generatedAt" in result

    def test_returns_most_recent_succeeded_run(self, db_session) -> None:
        from app.services.lichess_tactics_source import get_latest_source_run_metadata

        older = _make_source_run(
            db_session,
            finished_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        _make_metadata(db_session, older)

        newer = _make_source_run(
            db_session,
            finished_at=datetime(2025, 6, 1, tzinfo=timezone.utc),
        )
        _make_metadata(db_session, newer)
        db_session.commit()

        result = get_latest_source_run_metadata()
        assert result is not None
        assert result["latestSourceImportRunId"] == newer.id

    def test_returned_dict_has_all_required_keys(self, db_session) -> None:
        from app.services.lichess_tactics_source import get_latest_source_run_metadata

        run = _make_source_run(db_session)
        _make_metadata(db_session, run)
        db_session.commit()

        result = get_latest_source_run_metadata()
        assert result is not None
        expected_keys = {
            "latestSourceImportRunId", "importedCount", "totalTacticsAfterRun",
            "tacticsWithThemesCount", "tacticsWithOpeningsCount",
            "minRating", "maxRating", "averageRating",
            "ratingBucketCounts", "themeCounts", "openingCounts", "generatedAt",
        }
        assert expected_keys.issubset(result.keys())


# ── Integration: route ─────────────────────────────────────────────────────────

@pytest.mark.integration
class TestSourceRunMetadataRoute:
    def test_requires_login(self, client: FlaskClient) -> None:
        assert client.get("/sources/lichess-tactics/source-run-metadata").status_code == 401

    def test_returns_null_metadata_when_no_data(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)

        body = client.get("/sources/lichess-tactics/source-run-metadata").get_json()

        assert body == {"metadata": None}

    def test_returns_metadata_dict_when_succeeded_run_exists(self, client: FlaskClient, db_session) -> None:
        _login(client, _make_user(db_session).id)
        run = _make_source_run(db_session)
        _make_metadata(db_session, run)
        db_session.commit()

        body = client.get("/sources/lichess-tactics/source-run-metadata").get_json()

        assert body["metadata"] is not None
        assert body["metadata"]["latestSourceImportRunId"] == run.id
        assert body["metadata"]["importedCount"] == 900
        assert isinstance(body["metadata"]["ratingBucketCounts"], dict)
        assert isinstance(body["metadata"]["themeCounts"], dict)
        assert isinstance(body["metadata"]["openingCounts"], dict)

    def test_does_not_return_metadata_for_failed_run(self, client: FlaskClient, db_session) -> None:
        from app.models.source_import_run import SourceImportStatus

        _login(client, _make_user(db_session).id)
        _make_source_run(db_session, status=SourceImportStatus.FAILED)
        db_session.commit()

        body = client.get("/sources/lichess-tactics/source-run-metadata").get_json()

        assert body == {"metadata": None}
