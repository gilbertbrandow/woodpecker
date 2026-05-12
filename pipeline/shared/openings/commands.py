import click

from db import Session
from shared.openings.downloader import ensure_opening_files
from shared.openings.importer import import_openings


@click.group()
def openings() -> None:
    """Manage shared opening reference data."""


@openings.command("ensure-data")
def ensure_data() -> None:
    """Download opening source files if not present locally."""
    paths = ensure_opening_files()
    click.echo(f"Ready: {len(paths)} opening file(s) in {paths[0].parent}")


@openings.command("import")
def import_cmd() -> None:
    """Import openings into the database (idempotent)."""
    files = ensure_opening_files()
    with Session() as session:
        import_openings(session, files)
