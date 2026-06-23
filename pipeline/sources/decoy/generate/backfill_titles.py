"""One-off script to backfill whiteTitle/blackTitle into an existing decoy_positions.jsonl.

Builds a lookup from PGN headers (fast header-only pass), then patches each record.
"""

import argparse
import json
import sys
from pathlib import Path

import chess.pgn

from scan_games import _ensure_extracted


def _build_title_index(pgn_path: Path) -> dict[tuple, tuple[str | None, str | None]]:
    index: dict[tuple, tuple[str | None, str | None]] = {}
    with open(pgn_path, encoding="utf-8", errors="replace") as f:
        while True:
            headers = chess.pgn.read_headers(f)
            if headers is None:
                break
            key = (
                headers.get("White"),
                headers.get("Black"),
                headers.get("Event"),
                headers.get("Date"),
            )
            index[key] = (headers.get("WhiteTitle"), headers.get("BlackTitle"))
    print(f"Title index built: {len(index):,} games", flush=True)
    return index


def main() -> None:
    p = argparse.ArgumentParser(description="Backfill whiteTitle/blackTitle into decoy_positions.jsonl")
    p.add_argument("--games", required=True, type=Path, help="Path to PGN or .7z/.zip archive")
    p.add_argument("--file", required=True, type=Path, help="Path to decoy_positions.jsonl to patch")
    args = p.parse_args()

    if not args.games.exists():
        sys.exit(f"Games file not found: {args.games}")
    if not args.file.exists():
        sys.exit(f"JSONL file not found: {args.file}")

    pgn_path = _ensure_extracted(args.games)
    index = _build_title_index(pgn_path)

    patched = 0
    no_match = 0
    records: list[str] = []

    with open(args.file, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            key = (record.get("white"), record.get("black"), record.get("event"), record.get("date"))
            if key in index:
                white_title, black_title = index[key]
                record["whiteTitle"] = white_title
                record["blackTitle"] = black_title
                patched += 1
            else:
                record["whiteTitle"] = None
                record["blackTitle"] = None
                no_match += 1
            records.append(json.dumps(record, ensure_ascii=False))

    tmp = args.file.with_suffix(".jsonl.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(records) + "\n")
    tmp.replace(args.file)

    print(f"Patched:    {patched:,}")
    print(f"No match:   {no_match:,}  (titles set to null)")
    print(f"Output:     {args.file}")


if __name__ == "__main__":
    main()
