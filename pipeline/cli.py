import sys
from pathlib import Path

# Allow running without PYTHONPATH set in local dev — find backend relative to this file
_backend = Path(__file__).parent.parent / "backend"
if _backend.exists() and str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

import click

from openings.commands import openings
from sources.decoy.commands import decoy
from sources.lichess_tactics.commands import lichess_tactics
from sources.scraped_positional.commands import positional


@click.group()
def cli() -> None:
    """Woodpecker data pipeline."""


cli.add_command(openings)
cli.add_command(lichess_tactics)
cli.add_command(positional)
cli.add_command(decoy)


if __name__ == "__main__":
    cli()
