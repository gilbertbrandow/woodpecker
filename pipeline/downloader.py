from pathlib import Path

import click
import requests


def ensure_file(raw_dir: Path, name: str, url: str) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / name
    if path.exists():
        return path
    click.echo(f"Downloading {name} ...")
    # timeout=(connect_s, read_between_chunks_s) — not total transfer time
    resp = requests.get(url, timeout=(10, 300), stream=True)
    resp.raise_for_status()
    total = int(resp.headers.get("content-length", 0))
    written = 0
    with open(path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
            written += len(chunk)
            if total:
                click.echo(
                    f"\r  {written // (1024 * 1024)} MB / {total // (1024 * 1024)} MB"
                    f" ({written / total:.0%})",
                    nl=False,
                )
    click.echo()
    click.echo(f"Saved {path} ({path.stat().st_size:,} bytes)")
    return path
