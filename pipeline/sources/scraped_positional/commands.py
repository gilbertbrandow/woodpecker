from pathlib import Path

import click

from db import Session
from downloader import ensure_source_file
from run_support import execute_import_run
from sources.scraped_positional.difficulty_seeder import seed_difficulties
from sources.scraped_positional.puzzle_importer import import_puzzles
from sources.scraped_positional.theme_seeder import seed_themes
from app.models.source_import_run import (
    ScrapedPositionalSourceRunMetadata,
    SourceImportOperation,
    SourceImportSource,
)

_IMPORT_OPTIONS = [
    click.option("--limit", type=int, default=None, help="Maximum number of puzzles to import"),
    click.option("--batch-size", type=int, default=100, show_default=True, help="Enrichment + DB insert batch size"),
    click.option(
        "--api-token", "api_token",
        default=None,
        envvar="LICHESS_API_TOKEN",
        help="Lichess API token (or set LICHESS_API_TOKEN)",
    ),
]


def _add_import_options(fn):
    for option in reversed(_IMPORT_OPTIONS):
        fn = option(fn)
    return fn


def _execute_puzzle_import(
    file: Path,
    limit: int | None,
    batch_size: int,
    api_token: str | None,
) -> None:
    with Session() as session:
        execute_import_run(
            session,
            source=SourceImportSource.SCRAPED_POSITIONAL,
            operation=SourceImportOperation.SCRAPED_POSITIONAL_IMPORT,
            parameters={"limit": limit, "batch_size": batch_size, "file": str(file)},
            summary_keys=[
                "imported_count",
                "total_rows_seen",
                "skipped_existing_count",
                "enrichment_failures_count",
                "total_positional_after_run",
            ],
            fn=lambda sess, run_id: import_puzzles(sess, file, run_id, api_token, limit, batch_size),
            metadata_factory=lambda run_id, stats, generated_at: ScrapedPositionalSourceRunMetadata(
                source_import_run_id=run_id,
                imported_count=stats["imported_count"],
                skipped_existing_count=stats["skipped_existing_count"],
                enrichment_failures_count=stats["enrichment_failures_count"],
                total_positional_after_run=stats["total_positional_after_run"],
                difficulty_counts_json=stats["difficulty_counts"],
                theme_counts_json=stats["theme_counts"],
                generated_at=generated_at,
            ),
        )


@click.group("positional")
def positional() -> None:
    """Import and manage SCRAPED_POSITIONAL puzzle data."""


@positional.group()
def difficulties() -> None:
    """Manage positional difficulty tiers."""


@difficulties.command("import")
def difficulties_import() -> None:
    """Seed positional difficulty tiers (idempotent)."""
    with Session() as session:
        seed_difficulties(session)


@positional.group()
def themes() -> None:
    """Manage positional theme taxonomy."""


@themes.command("import")
def themes_import() -> None:
    """Seed positional themes (idempotent)."""
    with Session() as session:
        seed_themes(session)


@positional.group()
def puzzles() -> None:
    """Import positional puzzles."""


@puzzles.command("ensure-data")
def puzzles_ensure_data() -> None:
    """Download the positional puzzle CSV if not present locally."""
    path = ensure_source_file("scraped_positional")
    click.echo(f"Ready: {path}")


@puzzles.command("import")
@_add_import_options
def puzzles_import(limit: int | None, batch_size: int, api_token: str | None) -> None:
    """Import positional puzzles with FEN enrichment via Lichess API (idempotent)."""
    file = ensure_source_file("scraped_positional")
    _execute_puzzle_import(file, limit, batch_size, api_token)


@positional.command("import-all")
@_add_import_options
def import_all(limit: int | None, batch_size: int, api_token: str | None) -> None:
    """Seed lookup tables, download CSV, and import puzzles in one step (idempotent).

    Equivalent to running in sequence:
      positional difficulties import
      positional themes import
      positional puzzles ensure-data
      positional puzzles import
    """
    click.echo("--- Seeding difficulties ---")
    with Session() as session:
        seed_difficulties(session)

    click.echo("--- Seeding themes ---")
    with Session() as session:
        seed_themes(session)

    click.echo("--- Ensuring puzzle data ---")
    file = ensure_source_file("scraped_positional")

    click.echo("--- Importing puzzles ---")
    _execute_puzzle_import(file, limit, batch_size, api_token)
