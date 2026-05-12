import click


@click.group("lichess-tactics")
def lichess_tactics() -> None:
    """Import and validate Lichess tactic data."""


@lichess_tactics.group()
def themes() -> None:
    """Manage Lichess tactic theme taxonomy."""


@themes.command("ensure-data")
def themes_ensure_data() -> None:
    """Download theme source files if not present locally."""
    raise NotImplementedError


@themes.command("import")
def themes_import() -> None:
    """Import Lichess tactic themes into the database (idempotent)."""
    raise NotImplementedError


@lichess_tactics.group()
def tactics() -> None:
    """Import Lichess tactics."""


@tactics.command("import")
@click.option("--file", "file_path", required=True, type=click.Path(exists=True), help="Path to lichess_db_puzzle.csv or .csv.zst")
@click.option("--limit", type=int, default=None, help="Maximum number of tactics to import")
@click.option("--min-rating", type=int, default=None, help="Minimum puzzle rating")
@click.option("--max-rating", type=int, default=None, help="Maximum puzzle rating")
@click.option("--batch-size", type=int, default=1000, show_default=True, help="DB insert batch size")
def tactics_import(file_path: str, limit: int | None, min_rating: int | None, max_rating: int | None, batch_size: int) -> None:
    """Import Lichess tactics with theme and opening links (idempotent)."""
    raise NotImplementedError


@lichess_tactics.command("validate-links")
def validate_links() -> None:
    """Verify that tactic/theme/opening links are correct after import."""
    raise NotImplementedError
