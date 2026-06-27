from pathlib import Path

import click
import requests
import yaml


def ensure_file(raw_dir: Path, name: str, url: str) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / name
    if path.exists():
        return path
    click.echo(f"Downloading {name} ...")
    # timeout=(connect_s, read_between_chunks_s) — not total transfer time
    headers = {"User-Agent": "Mozilla/5.0 (compatible; woodpecker-pipeline/1.0)"}
    resp = requests.get(url, timeout=(10, 300), stream=True, headers=headers)
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


def ensure_source_file(key: str, *, large_note: bool = False) -> Path:
    data_dir = Path(__file__).parent / "data"
    with open(data_dir / "sources.yml") as f:
        sources = yaml.safe_load(f)
    entry = sources[key][0]
    path = data_dir / "raw" / entry["name"]
    if large_note and not path.exists():
        click.echo(f"Note: {entry['name']} is large (~1 GB compressed). Downloading from {entry['url']} ...")
    return ensure_file(data_dir / "raw", entry["name"], entry["url"])
