from pathlib import Path

import click

from db import Session
from sources.lichess_tactics.downloader import ensure_theme_file
from sources.lichess_tactics.theme_importer import import_themes
from sources.lichess_tactics.tactic_importer import import_tactics
from sources.lichess_tactics.validators import validate_links as _validate_links


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


@tactics.command("import")
@click.option("--file", "file_path", required=True, type=click.Path(exists=True), help="Path to lichess_db_puzzle.csv or .csv.zst")
@click.option("--limit", type=int, default=None, help="Maximum number of tactics to import")
@click.option("--min-rating", type=int, default=0, show_default=True, help="Minimum puzzle rating")
@click.option("--max-rating", type=int, default=9999, show_default=True, help="Maximum puzzle rating")
@click.option("--batch-size", type=int, default=500, show_default=True, help="DB insert batch size")
def tactics_import(
    file_path: str,
    limit: int | None,
    min_rating: int,
    max_rating: int,
    batch_size: int,
) -> None:
    """Import Lichess tactics with theme and opening links (idempotent)."""
    with Session() as session:
        import_tactics(session, Path(file_path), limit, min_rating, max_rating, batch_size)


@lichess_tactics.command("validate-links")
def validate_links_cmd() -> None:
    """Verify that tactic/theme/opening links are correct after import."""
    with Session() as session:
        _validate_links(session)
