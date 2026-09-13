from pathlib import Path

import click

from db import Session
from downloader import ensure_source_file
from run_support import execute_import_run
from sources.decoy.importer import import_decoys
from app.models.source_import_run import (
    DecoySourceRunMetadata,
    SourceImportOperation,
    SourceImportSource,
)


@click.group("decoy")
def decoy() -> None:
    """Import and manage DECOY puzzle data."""


@decoy.group()
def puzzles() -> None:
    """Import decoy puzzles."""


@puzzles.command("ensure-data")
def puzzles_ensure_data() -> None:
    """Download the decoy positions JSONL if not present locally."""
    path = ensure_source_file("decoy_positions")
    click.echo(f"Ready: {path}")


@puzzles.command("import")
@click.option(
    "--file",
    "file_path",
    default=None,
    type=click.Path(exists=True, path_type=Path),
    help="Path to decoy_positions.jsonl (downloaded automatically if omitted)",
)
@click.option("--limit", type=int, default=None, help="Maximum number of decoys to import")
@click.option("--batch-size", type=int, default=200, show_default=True, help="DB insert batch size")
def puzzles_import(file_path: Path | None, limit: int | None, batch_size: int) -> None:
    """Import decoy puzzles from a JSONL file (idempotent, keyed on FEN)."""
    file = file_path if file_path else ensure_source_file("decoy_positions")
    with Session() as session:
        execute_import_run(
            session,
            source=SourceImportSource.DECOY,
            operation=SourceImportOperation.DECOY_IMPORT,
            parameters={"limit": limit, "batch_size": batch_size, "file": str(file)},
            summary_keys=["imported_count", "skipped_existing_count", "total_decoys_after_run"],
            fn=lambda sess, run_id: import_decoys(sess, file, run_id, limit, batch_size),
            metadata_factory=lambda run_id, stats, generated_at: DecoySourceRunMetadata(
                source_import_run_id=run_id,
                imported_count=stats["imported_count"],
                skipped_existing_count=stats["skipped_existing_count"],
                total_decoys_after_run=stats["total_decoys_after_run"],
                opening_counts_json=stats["opening_counts"],
                generated_at=generated_at,
            ),
        )
