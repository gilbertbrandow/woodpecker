from pathlib import Path

import click
import requests


def ensure_file(raw_dir: Path, name: str, url: str) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / name
    if not path.exists():
        click.echo(f"Downloading {name} ...")
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        click.echo(f"Saved {path} ({path.stat().st_size:,} bytes)")
    return path
