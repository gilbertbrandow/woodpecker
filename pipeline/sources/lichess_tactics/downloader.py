from pathlib import Path

import yaml

from downloader import ensure_file

DATA_DIR = Path(__file__).parents[2] / "data"


def _load_sources() -> dict:
    with open(DATA_DIR / "sources.yml") as f:
        return yaml.safe_load(f)


def ensure_theme_file() -> Path:
    entry = _load_sources()["lichess_tactic_themes"][0]
    return ensure_file(DATA_DIR / "raw", entry["name"], entry["url"])


def ensure_tactics_file() -> Path:
    entry = _load_sources()["lichess_tactics"][0]
    path = DATA_DIR / "raw" / entry["name"]
    if not path.exists():
        import click
        click.echo(
            f"Note: {entry['name']} is large (~1 GB compressed). Downloading from {entry['url']} ..."
        )
    return ensure_file(DATA_DIR / "raw", entry["name"], entry["url"])
