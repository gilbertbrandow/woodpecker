import click

from shared.openings.commands import openings
from sources.lichess_tactics.commands import lichess_tactics


@click.group()
def shared() -> None:
    """Shared reference data (openings, etc.)."""


shared.add_command(openings)


@click.group()
def cli() -> None:
    """Woodpecker data pipeline."""


cli.add_command(shared)
cli.add_command(lichess_tactics)


if __name__ == "__main__":
    cli()
