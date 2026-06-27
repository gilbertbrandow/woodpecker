"""Build the qualifying-positions SQLite from the Lichess eval JSONL."""

import argparse
import sys
from pathlib import Path

import eval_db  # type: ignore[import-not-found]


def main() -> None:
    p = argparse.ArgumentParser(description="Build decoy_evals.sqlite from lichess_db_eval.jsonl.zst")
    p.add_argument("--src", required=True, type=Path, help="Path to lichess_db_eval.jsonl.zst")
    p.add_argument("--out", required=True, type=Path, help="Output SQLite path")
    p.add_argument("--force", action="store_true", help="Rebuild even if DB already has data")
    p.add_argument("--limit", type=int, default=None, help="Stop after N input lines (for testing)")
    args = p.parse_args()

    if not args.src.exists():
        sys.exit(f"Source file not found: {args.src}")

    eval_db.build(args.src, args.out, force=args.force, limit=args.limit)


if __name__ == "__main__":
    main()
