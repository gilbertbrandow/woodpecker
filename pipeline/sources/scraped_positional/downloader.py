from pathlib import Path

import yaml

from downloader import ensure_file

DATA_DIR = Path(__file__).parents[2] / "data"


def _load_sources() -> dict:
    with open(DATA_DIR / "sources.yml") as f:
        return yaml.safe_load(f)


def ensure_puzzles_file() -> Path:
    entry = _load_sources()["scraped_positional"][0]
    return ensure_file(DATA_DIR / "raw", entry["name"], entry["url"])
