"""
FEN enrichment for SCRAPED_POSITIONAL puzzles.

The CSV provides FEN at the position where the user must play. The SolveContract
invariant requires FEN = position *before* the opponent's last move, with moves[0]
being that opponent move. This module fetches Lichess game move lists and walks
back one ply to produce the enriched (pre-opponent) FEN and the paired moves string.
"""
import json
import time
from typing import Any

import chess
import click
import requests

LICHESS_EXPORT_URL = "https://lichess.org/api/games/export/_ids"
REQUEST_TIMEOUT = 60
RATE_LIMIT_SLEEP = 1.0


def fetch_game_moves(game_ids: list[str], api_token: str | None) -> dict[str, str]:
    """
    Fetch UCI move strings for a batch of Lichess game IDs (max 300 per call).
    Returns {game_id: "uci_move1 uci_move2 ..."}.
    """
    headers: dict[str, str] = {"Accept": "application/x-ndjson"}
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    response = requests.post(
        LICHESS_EXPORT_URL,
        data={"ids": ",".join(game_ids)},
        headers=headers,
        timeout=REQUEST_TIMEOUT,
        stream=True,
    )
    response.raise_for_status()

    result: dict[str, str] = {}
    for raw_line in response.iter_lines():
        if not raw_line:
            continue
        game: dict[str, Any] = json.loads(raw_line)
        gid = game.get("id", "")
        if gid:
            result[gid] = game.get("moves", "")
    return result


def enrich_puzzle(
    moves_str: str,
    ply: int,
    best_move: str,
) -> tuple[str, str] | None:
    """
    Compute the enriched FEN and moves string for one puzzle.

    Args:
        moves_str: space-separated UCI move string for the full game.
        ply: 1-indexed ply at which the user plays (from the CSV move_number column).
        best_move: UCI move the user must play (from CSV best_move column).

    Returns:
        (enriched_fen, moves_string) where enriched_fen is the position before the
        opponent's last move and moves_string is "{opponent_move} {best_move}".
        Returns None if enrichment fails (game too short, illegal move, etc.).
    """
    moves = moves_str.split()
    if len(moves) < ply:
        return None

    board = chess.Board()
    try:
        for i in range(ply - 1):
            board.push_uci(moves[i])
        enriched_fen = board.fen()
        opponent_move = moves[ply - 1]
        return (enriched_fen, f"{opponent_move} {best_move}")
    except Exception:
        return None


def enrich_batch(
    puzzles: list[dict[str, Any]],
    api_token: str | None,
    batch_size: int = 300,
) -> list[tuple[str, str] | None]:
    """
    Enrich a list of puzzle dicts with FEN and moves via Lichess API.

    Each puzzle dict must have keys: lichess_game_id, move_number, best_move.
    Returns a parallel list of (enriched_fen, moves_string) or None per puzzle.
    """
    results: list[tuple[str, str] | None] = [None] * len(puzzles)

    for batch_start in range(0, len(puzzles), batch_size):
        batch = puzzles[batch_start : batch_start + batch_size]
        game_ids = [p["lichess_game_id"] for p in batch]

        try:
            moves_map = fetch_game_moves(game_ids, api_token)
        except requests.HTTPError as exc:
            click.echo(f"Warning: Lichess API HTTP error for batch at offset {batch_start}: {exc}")
            continue

        for local_idx, puzzle in enumerate(batch):
            global_idx = batch_start + local_idx
            game_id = puzzle["lichess_game_id"]
            moves_str = moves_map.get(game_id, "")
            if not moves_str:
                continue
            result = enrich_puzzle(moves_str, puzzle["move_number"], puzzle["best_move"])
            results[global_idx] = result

        if batch_start + batch_size < len(puzzles):
            time.sleep(RATE_LIMIT_SLEEP)

    return results
