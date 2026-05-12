import click


@click.group()
def openings() -> None:
    """Manage shared opening reference data."""


@openings.command("ensure-data")
def ensure_data() -> None:
    """Download opening source files if not present locally."""
    raise NotImplementedError


@openings.command("import")
def import_cmd() -> None:
    """Import openings into the database (idempotent)."""
    raise NotImplementedError
