from pathlib import Path

import yaml

from downloader import ensure_file

DATA_DIR = Path(__file__).parents[2] / "data"


def ensure_theme_file() -> Path:
    with open(DATA_DIR / "sources.yml") as f:
        sources = yaml.safe_load(f)

    entry = sources["lichess_tactic_themes"][0]
    return ensure_file(DATA_DIR / "raw", entry["name"], entry["url"])
