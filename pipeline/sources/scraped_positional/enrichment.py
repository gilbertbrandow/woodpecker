"""
FEN enrichment for SCRAPED_POSITIONAL puzzles.

The CSV provides FEN at the position where the user must play. The SolveContract
invariant requires FEN = position *before* the opponent's last move, with moves[0]
being that opponent move. This module fetches Lichess game move lists and walks
back one ply to produce the enriched (pre-opponent) FEN and the paired moves string.

Opening enrichment: for puzzles at or before ply OPENING_PLY_CUTOFF, the Lichess
game export's opening field (eco + name) is extracted and returned alongside the FEN.
This maps to 20 full moves — the practical boundary of opening theory in these games.
"""
import json
import time
from collections.abc import Callable
from typing import Any

import chess
import click
import requests

LICHESS_EXPORT_URL = "https://lichess.org/api/games/export/_ids"
REQUEST_TIMEOUT = 60
RATE_LIMIT_SLEEP = 1.0
# Positions at or before this ply (20 full moves) are candidates for opening linking.
OPENING_PLY_CUTOFF = 40

FetchFn = Callable[[list[str], str | None], dict[str, dict[str, Any]]]


def fetch_game_data(game_ids: list[str], api_token: str | None) -> dict[str, dict[str, Any]]:
    """
    Fetch move strings and opening data for a batch of Lichess game IDs (max 300 per call).
    Returns {game_id: {"moves": "san1 san2 ...", "opening": {"eco": "C50", "name": "...", "ply": 5} | None}}.
    """
    headers: dict[str, str] = {"Accept": "application/x-ndjson"}
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    response = requests.post(
        LICHESS_EXPORT_URL,
        params={"opening": "true"},
        data=",".join(game_ids),
        headers={**headers, "Content-Type": "text/plain"},
        timeout=REQUEST_TIMEOUT,
        stream=True,
    )
    response.raise_for_status()

    result: dict[str, dict[str, Any]] = {}
    for raw_line in response.iter_lines():
        if not raw_line:
            continue
        game: dict[str, Any] = json.loads(raw_line)
        gid = game.get("id", "")
        if gid:
            result[gid] = {
                "moves": game.get("moves", ""),
                "opening": game.get("opening"),
            }
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

    # Lichess NDJSON returns moves in SAN (e.g. "Nf6", "O-O"), not UCI.
    # Parse each SAN move via python-chess to replay the game and extract UCI.
    board = chess.Board()
    try:
        for i in range(ply - 1):
            board.push_san(moves[i])
        enriched_fen = board.fen()
        opponent_move_obj = board.parse_san(moves[ply - 1])
        opponent_uci = opponent_move_obj.uci()
        return (enriched_fen, f"{opponent_uci} {best_move}")
    except Exception:
        return None


def enrich_batch(
    puzzles: list[dict[str, Any]],
    api_token: str | None,
    batch_size: int = 300,
    *,
    fetch_fn: FetchFn = fetch_game_data,
) -> list[tuple[str, str, dict[str, Any] | None] | None]:
    """
    Enrich a list of puzzle dicts with FEN, moves, and opening data via Lichess API.

    Each puzzle dict must have keys: lichess_game_id, move_number, best_move.
    Returns a parallel list of (enriched_fen, moves_string, opening_data) or None per puzzle.
    opening_data is the Lichess opening object ({"eco", "name", "ply"}) or None when the
    puzzle is beyond OPENING_PLY_CUTOFF or the game has no recognized opening.
    """
    results: list[tuple[str, str, dict[str, Any] | None] | None] = [None] * len(puzzles)

    for batch_start in range(0, len(puzzles), batch_size):
        batch = puzzles[batch_start : batch_start + batch_size]
        game_ids = [p["lichess_game_id"] for p in batch]

        try:
            game_map = fetch_fn(game_ids, api_token)
        except requests.HTTPError as exc:
            click.echo(f"Warning: Lichess API HTTP error for batch at offset {batch_start}: {exc}")
            continue

        for local_idx, puzzle in enumerate(batch):
            global_idx = batch_start + local_idx
            game_id = puzzle["lichess_game_id"]
            game_data = game_map.get(game_id, {})
            moves_str = game_data.get("moves", "")
            if not moves_str:
                continue
            result = enrich_puzzle(moves_str, puzzle["move_number"], puzzle["best_move"])
            if result is None:
                continue
            enriched_fen, moves_string = result
            opening = game_data.get("opening") if puzzle["move_number"] <= OPENING_PLY_CUTOFF else None
            results[global_idx] = (enriched_fen, moves_string, opening)

        if batch_start + batch_size < len(puzzles):
            time.sleep(RATE_LIMIT_SLEEP)

    return results
