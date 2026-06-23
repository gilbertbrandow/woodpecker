import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import click
import sqlalchemy as sa
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.models.decoy_puzzle import DecoyPuzzle
from app.models.game import Game
from app.models.opening import Opening

PROGRESS_INTERVAL = 500

_REQUIRED_FIELDS = {"fen", "opponentMove", "acceptedMoves", "bestCp", "depth", "moveNumber"}


@dataclass
class ImportBatchResult:
    imported: int
    skipped_existing: int


def _safe_int(val: Any) -> int | None:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _build_analysis_url(lichess_game_url: str | None, fen: str, move_number: int) -> str | None:
    if not lichess_game_url:
        return None
    game_id = lichess_game_url.rstrip("/").split("/")[-1]
    parts = fen.split()
    side_to_move = parts[1] if len(parts) >= 2 else "w"
    # fen is the position BEFORE opponent's last move; opponent's side is side_to_move.
    # If opponent is white (side_to_move == "w"), the solver is black → /black orientation.
    orientation = "/black" if side_to_move == "w" else ""
    ply = move_number - 1
    return f"https://lichess.org/{game_id}{orientation}#{ply}"


def _load_opening_caches(session: Session) -> tuple[dict[str, int], dict[str, list[tuple[int, str]]]]:
    rows = session.execute(select(Opening.id, Opening.eco, Opening.display_name)).all()
    by_display_name: dict[str, int] = {}
    by_eco: dict[str, list[tuple[int, str]]] = {}
    for id_, eco, display_name in rows:
        by_display_name[display_name] = id_
        by_eco.setdefault(eco, []).append((id_, display_name))
    return by_display_name, by_eco


def _find_opening_id(
    eco: str | None,
    opening_name: str | None,
    by_display_name: dict[str, int],
    by_eco: dict[str, list[tuple[int, str]]],
) -> int | None:
    if opening_name and opening_name in by_display_name:
        return by_display_name[opening_name]
    if eco:
        # Lichess ECO codes use sub-variant suffixes (e.g. "D24b"); fall back to base 3-char code.
        for code in dict.fromkeys([eco, eco[:3]]):
            candidates = by_eco.get(code, [])
            if candidates:
                return candidates[0][0]
    return None


def _upsert_games(
    session: Session,
    items: list[dict[str, Any]],
    source_import_run_id: int,
    opening_by_display_name: dict[str, int],
    opening_by_eco: dict[str, list[tuple[int, str]]],
) -> dict[str, int]:
    """Insert new games (keyed on lichess_id) and return lichess_id → game.id map."""
    lichess_ids = {
        item["lichessGameUrl"].split("/")[-1]
        for item in items
        if item.get("lichessGameUrl")
    }
    if not lichess_ids:
        return {}

    rows = session.execute(
        select(Game.lichess_id, Game.id).where(Game.lichess_id.in_(lichess_ids))
    ).all()
    existing: dict[str, int] = {row.lichess_id: row.id for row in rows}

    new_games: list[Game] = []
    new_game_lichess_ids: list[str] = []
    seen: set[str] = set(existing.keys())

    for item in items:
        url = item.get("lichessGameUrl")
        if not url:
            continue
        lichess_id = url.split("/")[-1]
        if lichess_id in seen:
            continue
        seen.add(lichess_id)
        new_games.append(
            Game(
                lichess_id=lichess_id,
                white=item["white"],
                black=item["black"],
                white_elo=_safe_int(item.get("whiteElo")),
                black_elo=_safe_int(item.get("blackElo")),
                white_title=item.get("whiteTitle"),
                black_title=item.get("blackTitle"),
                event=item.get("event"),
                date=item.get("date"),
                eco=item.get("eco"),
                opening_id=_find_opening_id(
                    item.get("eco"),
                    item.get("openingName"),
                    opening_by_display_name,
                    opening_by_eco,
                ),
                source_import_run_id=source_import_run_id,
            )
        )
        new_game_lichess_ids.append(lichess_id)

    if new_games:
        session.add_all(new_games)
        session.flush()

    result = dict(existing)
    for game, lichess_id in zip(new_games, new_game_lichess_ids):
        result[lichess_id] = game.id
    return result


def process_batch(
    session: Session,
    batch: list[dict[str, Any]],
    source_import_run_id: int,
    opening_by_display_name: dict[str, int],
    opening_by_eco: dict[str, list[tuple[int, str]]],
) -> ImportBatchResult:
    if not batch:
        return ImportBatchResult(imported=0, skipped_existing=0)

    fens = [item["fen"] for item in batch]
    existing_fens: set[str] = set(
        session.scalars(select(DecoyPuzzle.fen).where(DecoyPuzzle.fen.in_(fens))).all()
    )

    new_items = [item for item in batch if item["fen"] not in existing_fens]
    skipped_existing = len(batch) - len(new_items)

    if not new_items:
        return ImportBatchResult(imported=0, skipped_existing=skipped_existing)

    game_id_map = _upsert_games(
        session, new_items, source_import_run_id,
        opening_by_display_name, opening_by_eco,
    )

    n = len(new_items)
    ti_result = cast(
        CursorResult[Any],
        session.execute(
            sa.text(
                "INSERT INTO training_items (source_type, source_import_run_id) "
                "SELECT 'DECOY', :run_id FROM generate_series(1, :n) "
                "RETURNING id"
            ),
            {"n": n, "run_id": source_import_run_id},
        ),
    )
    new_ti_ids = [row.id for row in ti_result]

    decoy_rows: list[dict[str, Any]] = []
    for item, ti_id in zip(new_items, new_ti_ids):
        url = item.get("lichessGameUrl")
        lichess_id = url.split("/")[-1] if url else None
        game_id = game_id_map.get(lichess_id) if lichess_id else None
        analysis_url = _build_analysis_url(url, item["fen"], item["moveNumber"])
        decoy_rows.append({
            "training_item_id": ti_id,
            "fen": item["fen"],
            "opponent_move": item["opponentMove"],
            "accepted_moves": json.dumps(item["acceptedMoves"]),
            "best_cp": item["bestCp"],
            "depth": item["depth"],
            "move_number": item["moveNumber"],
            "game_id": game_id,
            "analysis_url": analysis_url,
        })

    session.execute(
        pg_insert(cast(sa.Table, DecoyPuzzle.__table__))
        .values(decoy_rows)
        .on_conflict_do_nothing(index_elements=["training_item_id"])
    )
    session.commit()

    return ImportBatchResult(imported=len(new_items), skipped_existing=skipped_existing)


def import_decoys(
    session: Session,
    file: Path,
    source_import_run_id: int,
    limit: int | None,
    batch_size: int,
) -> dict[str, Any]:
    opening_by_display_name, opening_by_eco = _load_opening_caches(session)

    start = time.monotonic()
    rows_read = 0
    rows_imported = 0
    rows_skipped_existing = 0
    rows_malformed = 0

    pending: list[dict[str, Any]] = []

    with open(file, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as e:
                rows_malformed += 1
                click.echo(f"Warning: skipping malformed line {rows_read + rows_malformed}: {e}")
                continue

            missing = _REQUIRED_FIELDS - set(item.keys())
            if missing:
                rows_malformed += 1
                click.echo(f"Warning: skipping record {rows_read + rows_malformed}: missing fields {missing}")
                continue

            rows_read += 1
            pending.append(item)

            if len(pending) >= batch_size:
                result = process_batch(
                    session, pending, source_import_run_id,
                    opening_by_display_name, opening_by_eco,
                )
                pending.clear()
                rows_imported += result.imported
                rows_skipped_existing += result.skipped_existing
                if limit is not None and rows_imported >= limit:
                    break

            if rows_read % PROGRESS_INTERVAL == 0:
                click.echo(
                    f"Read {rows_read:,} | Imported {rows_imported:,} | "
                    f"Skipped existing {rows_skipped_existing:,}"
                )

    if pending:
        result = process_batch(
            session, pending, source_import_run_id,
            opening_by_display_name, opening_by_eco,
        )
        rows_imported += result.imported
        rows_skipped_existing += result.skipped_existing

    elapsed = time.monotonic() - start
    click.echo(
        f"\nDone. Imported: {rows_imported:,} | Skipped existing: {rows_skipped_existing:,} | "
        f"Malformed: {rows_malformed:,} | Time: {elapsed:.1f}s"
    )

    total_after = session.scalar(select(func.count()).select_from(DecoyPuzzle)) or 0

    opening_rows = session.execute(
        sa_text("""
            SELECT COALESCE(o.display_name, 'Unknown') AS name, COUNT(*) AS cnt
            FROM decoy_puzzles dp
            LEFT JOIN games g ON g.id = dp.game_id
            LEFT JOIN openings o ON o.id = g.opening_id
            WHERE dp.training_item_id IN (
                SELECT id FROM training_items WHERE source_import_run_id = :run_id
            )
            GROUP BY o.display_name
        """),
        {"run_id": source_import_run_id},
    ).all()
    opening_counts = {r.name: int(r.cnt) for r in opening_rows}

    return {
        "imported_count": rows_imported,
        "skipped_existing_count": rows_skipped_existing,
        "total_decoys_after_run": total_after,
        "opening_counts": opening_counts,
    }
