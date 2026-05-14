from datetime import datetime, timezone
from pathlib import Path

import click

from db import Session
from sources.lichess_tactics.downloader import ensure_theme_file, ensure_tactics_file
from sources.lichess_tactics.theme_importer import import_themes
from sources.lichess_tactics.tactic_importer import import_tactics
from sources.lichess_tactics.validators import validate_links as _validate_links
from app.models.source_import_run import (
    SourceImportRun,
    SourceImportSource,
    SourceImportOperation,
    SourceImportStatus,
    LichessTacticsSourceRunMetadata,
)


@click.group("lichess-tactics")
def lichess_tactics() -> None:
    """Import and validate Lichess tactic data."""


@lichess_tactics.group()
def themes() -> None:
    """Manage Lichess tactic theme taxonomy."""


@themes.command("ensure-data")
def themes_ensure_data() -> None:
    """Download theme source files if not present locally."""
    path = ensure_theme_file()
    click.echo(f"Ready: {path}")


@themes.command("import")
def themes_import() -> None:
    """Import Lichess tactic themes into the database (idempotent)."""
    file = ensure_theme_file()
    with Session() as session:
        import_themes(session, file)


@lichess_tactics.group()
def tactics() -> None:
    """Import Lichess tactics."""


@tactics.command("ensure-data")
def tactics_ensure_data() -> None:
    """Download the Lichess puzzle CSV if not present locally."""
    path = ensure_tactics_file()
    click.echo(f"Ready: {path}")


@tactics.command("import")
@click.option("--file", "file_path", default=None, type=click.Path(exists=True), help="Path to lichess_db_puzzle.csv or .csv.zst (downloaded automatically if omitted)")
@click.option("--limit", type=int, default=None, help="Maximum number of tactics to import")
@click.option("--min-rating", type=int, default=0, show_default=True, help="Minimum puzzle rating")
@click.option("--max-rating", type=int, default=9999, show_default=True, help="Maximum puzzle rating")
@click.option("--batch-size", type=int, default=500, show_default=True, help="DB insert batch size")
def tactics_import(
    file_path: str | None,
    limit: int | None,
    min_rating: int,
    max_rating: int,
    batch_size: int,
) -> None:
    """Import Lichess tactics with theme and opening links (idempotent)."""
    file = Path(file_path) if file_path else ensure_tactics_file()
    with Session() as session:
        run = SourceImportRun(
            source=SourceImportSource.LICHESS_TACTICS,
            operation=SourceImportOperation.LICHESS_TACTICS_IMPORT,
            status=SourceImportStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            parameters_json={
                "limit": limit,
                "min_rating": min_rating,
                "max_rating": max_rating,
                "batch_size": batch_size,
                "file": str(file),
            },
        )
        session.add(run)
        # Commit the RUNNING row before import so the FK on training_items resolves
        # from the very first batch commit inside import_tactics.
        session.commit()
        run_id = run.id

        try:
            stats = import_tactics(
                session, file, run_id, limit, min_rating, max_rating, batch_size
            )

            meta = LichessTacticsSourceRunMetadata(
                source_import_run_id=run_id,
                imported_count=stats["imported_count"],
                total_tactics_after_run=stats["total_tactics_after_run"],
                tactics_with_themes_count=stats["tactics_with_themes_count"],
                tactics_with_openings_count=stats["tactics_with_openings_count"],
                min_rating=stats["min_rating"],
                max_rating=stats["max_rating"],
                average_rating=stats["average_rating"],
                rating_bucket_counts_json=stats["rating_bucket_counts"],
                theme_counts_json=stats["theme_counts"],
                opening_counts_json=stats["opening_counts"],
                generated_at=datetime.now(timezone.utc),
            )
            session.add(meta)

            run.status = SourceImportStatus.SUCCEEDED
            run.finished_at = datetime.now(timezone.utc)
            run.summary_json = {
                "imported_count": stats["imported_count"],
                "total_rows_seen": stats["total_rows_seen"],
                "skipped_existing_count": stats["skipped_existing_count"],
                "total_tactics_after_run": stats["total_tactics_after_run"],
            }
            session.commit()

        except Exception as e:
            session.rollback()
            run.status = SourceImportStatus.FAILED
            run.finished_at = datetime.now(timezone.utc)
            run.error_message = str(e)[:2000]
            session.commit()
            raise


@lichess_tactics.command("validate-links")
def validate_links_cmd() -> None:
    """Verify that tactic/theme/opening links are correct after import."""
    with Session() as session:
        _validate_links(session)
