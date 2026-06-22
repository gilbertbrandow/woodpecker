"""Scan OTB master games against the eval SQLite and write decoy positions to JSONL."""

import argparse
import os
import sys
from pathlib import Path

import scan_games


def main() -> None:
    p = argparse.ArgumentParser(description="Scan master games for decoy positions")
    p.add_argument("--games", required=True, type=Path, help="Path to PGN or .7z/.zip archive")
    p.add_argument("--db", required=True, type=Path, help="Path to decoy_evals.sqlite")
    p.add_argument("--out", required=True, type=Path, help="Output JSONL path for decoy records")
    p.add_argument("--sort-by-elo", action="store_true", help="Process highest-rated games first")
    p.add_argument("--min-both-elo", type=int, default=2600, help="Minimum ELO for both players")
    p.add_argument("--event-filter", type=str, default=None, help="Only include games whose Event header contains this string")
    p.add_argument("--games-limit", type=int, default=None, help="Stop after N games")
    p.add_argument("--decoys-limit", type=int, default=None, help="Stop after N decoys found")
    p.add_argument("--max-per-game", type=int, default=2, help="Max decoys to emit per game")
    p.add_argument("--no-lichess-urls", action="store_true", help="Skip Lichess game URL lookup (faster, for testing)")
    p.add_argument("--lichess-token", default=os.environ.get("LICHESS_TOKEN"), help="Lichess API token (or set LICHESS_TOKEN env var)")
    args = p.parse_args()

    if not args.games.exists():
        sys.exit(f"Games file not found: {args.games}")
    if not args.db.exists():
        sys.exit(f"Eval DB not found: {args.db}. Run: make build-evals")

    args.out.parent.mkdir(parents=True, exist_ok=True)

    scan_games.scan(
        args.games,
        args.out,
        db_path=args.db,
        min_both_elo=args.min_both_elo,
        sort_by_elo=args.sort_by_elo,
        event_filter=args.event_filter,
        games_limit=args.games_limit,
        decoys_limit=args.decoys_limit,
        max_per_game=args.max_per_game,
        fetch_lichess_urls=not args.no_lichess_urls,
        lichess_token=args.lichess_token,
    )


if __name__ == "__main__":
    main()
