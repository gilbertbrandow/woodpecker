from pathlib import Path

import yaml

from downloader import ensure_file

DATA_DIR = Path(__file__).parents[2] / "data"


def ensure_opening_files() -> list[Path]:
    with open(DATA_DIR / "sources.yml") as f:
        sources = yaml.safe_load(f)

    raw_dir = DATA_DIR / "raw"
    return [ensure_file(raw_dir, entry["name"], entry["url"]) for entry in sources["openings"]]
