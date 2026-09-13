"""
Shared utilities for fetching and upserting SourceGame rows from the Lichess API.

Used by all three importers (LichessTactic, ScrapedPositional, Decoy) and the
backfill CLI to populate games.moves and games.game_id foreign keys.
"""
import json
import time
from datetime import datetime, timezone
from typing import Any

import chess
import click
import requests
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.game import SourceGame

LICHESS_EXPORT_URL = "https://lichess.org/api/games/export/_ids"
REQUEST_TIMEOUT = 60
RATE_LIMIT_SLEEP = 1.0


def san_moves_to_uci(san_moves: str) -> str | None:
    """Convert a space-separated SAN move string to UCI. Returns None on any parse failure."""
    if not san_moves:
        return None
    board = chess.Board()
    uci: list[str] = []
    for san in san_moves.split():
        try:
            move = board.parse_san(san)
            uci.append(move.uci())
            board.push(move)
        except Exception:
            return None
    return " ".join(uci)


def fetch_full_game_data(
    game_ids: list[str],
    api_token: str | None,
) -> dict[str, dict[str, Any]]:
    """
    Fetch full game data for up to 300 Lichess game IDs via the bulk export endpoint.

    Returns a dict keyed by game ID with entries:
      moves_san   - raw SAN move string from the API
      moves_uci   - full-game UCI move string (None if conversion fails)
      opening     - Lichess opening object {"eco", "name", "ply"} or None
      white       - white player username
      black       - black player username
      white_elo   - white player rating (int or None)
      black_elo   - black player rating (int or None)
      white_title - FIDE title or None
      black_title - FIDE title or None
      event       - perf type string ("blitz", "rapid", etc.) or None
      date        - ISO date string derived from createdAt, or None
      eco         - ECO code from opening, or None
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
        if not gid:
            continue

        san_moves = game.get("moves", "")
        moves_uci = san_moves_to_uci(san_moves) if san_moves else None

        white_p = game.get("players", {}).get("white", {})
        black_p = game.get("players", {}).get("black", {})
        white_user = white_p.get("user") or {}
        black_user = black_p.get("user") or {}

        opening = game.get("opening")
        created_at = game.get("createdAt")
        date_str: str | None = None
        if created_at:
            date_str = datetime.fromtimestamp(created_at / 1000, tz=timezone.utc).strftime("%Y.%m.%d")

        result[gid] = {
            "moves_san": san_moves,
            "moves_uci": moves_uci,
            "opening": opening,
            "white": white_user.get("name") or "?",
            "black": black_user.get("name") or "?",
            "white_elo": white_p.get("rating"),
            "black_elo": black_p.get("rating"),
            "white_title": white_user.get("title"),
            "black_title": black_user.get("title"),
            "event": game.get("perf"),
            "date": date_str,
            "eco": opening.get("eco") if opening else None,
        }
    return result


def _resolve_opening_id(
    eco: str | None,
    opening_name: str | None,
    by_display_name: dict[str, int],
    by_eco: dict[str, list[tuple[int, str]]],
) -> int | None:
    if opening_name and opening_name in by_display_name:
        return by_display_name[opening_name]
    if eco:
        candidates = by_eco.get(eco, [])
        if candidates:
            return candidates[0][0]
    return None


def upsert_source_games(
    session: Session,
    game_data: dict[str, dict[str, Any]],
    source_import_run_id: int,
    opening_by_display_name: dict[str, int],
    opening_by_eco: dict[str, list[tuple[int, str]]],
) -> dict[str, int]:
    """
    Insert new SourceGame rows and update moves on existing ones.

    game_data is keyed by lichess_id; values are dicts as returned by fetch_full_game_data.
    Returns a lichess_id → db game.id map covering all provided IDs that are now in the DB.
    """
    if not game_data:
        return {}

    lichess_ids = list(game_data.keys())
    existing_rows = session.execute(
        select(SourceGame.lichess_id, SourceGame.id)
        .where(SourceGame.lichess_id.in_(lichess_ids))
    ).all()
    existing_map: dict[str, int] = {row.lichess_id: row.id for row in existing_rows}
    result: dict[str, int] = dict(existing_map)

    for lichess_id, game_id in existing_map.items():
        moves_uci = game_data[lichess_id].get("moves_uci")
        if moves_uci is not None:
            session.execute(
                sa.update(SourceGame.__table__)
                .where(SourceGame.__table__.c.id == game_id)
                .values(moves=moves_uci)
            )

    new_rows: list[dict[str, Any]] = []
    for lichess_id, data in game_data.items():
        if lichess_id in existing_map:
            continue
        opening = data.get("opening") or {}
        opening_name = opening.get("name") if isinstance(opening, dict) else None
        eco = data.get("eco")
        opening_id = _resolve_opening_id(eco, opening_name, opening_by_display_name, opening_by_eco)
        new_rows.append({
            "lichess_id": lichess_id,
            "white": data.get("white") or "?",
            "black": data.get("black") or "?",
            "white_elo": data.get("white_elo"),
            "black_elo": data.get("black_elo"),
            "white_title": data.get("white_title"),
            "black_title": data.get("black_title"),
            "event": data.get("event"),
            "date": data.get("date"),
            "eco": eco,
            "moves": data.get("moves_uci"),
            "opening_id": opening_id,
            "source_import_run_id": source_import_run_id,
        })

    if new_rows:
        inserted = session.execute(
            pg_insert(SourceGame.__table__)
            .values(new_rows)
            .on_conflict_do_nothing(index_elements=["lichess_id"])
            .returning(SourceGame.__table__.c.id, SourceGame.__table__.c.lichess_id)
        ).all()
        for row in inserted:
            result[row.lichess_id] = row.id

    return result


def populate_game_moves(
    session: Session,
    lichess_id_to_game_id: dict[str, int],
    api_token: str | None,
    batch_size: int = 300,
) -> int:
    """
    Fetch and store UCI moves for existing SourceGame rows that have no moves yet.

    lichess_id_to_game_id maps lichess_id → db game.id for rows that need updating.
    Returns the number of games updated.
    """
    ids = list(lichess_id_to_game_id.keys())
    updated = 0
    for batch_start in range(0, len(ids), batch_size):
        batch_ids = ids[batch_start: batch_start + batch_size]
        try:
            game_map = fetch_full_game_data(batch_ids, api_token)
        except requests.HTTPError as exc:
            click.echo(f"Warning: Lichess API error for batch at offset {batch_start}: {exc}")
            continue
        for lichess_id in batch_ids:
            data = game_map.get(lichess_id)
            if not data or not data.get("moves_uci"):
                continue
            db_id = lichess_id_to_game_id[lichess_id]
            session.execute(
                sa.update(SourceGame.__table__)
                .where(SourceGame.__table__.c.id == db_id)
                .values(moves=data["moves_uci"])
            )
            updated += 1
        if batch_start + batch_size < len(ids):
            time.sleep(RATE_LIMIT_SLEEP)
    return updated
