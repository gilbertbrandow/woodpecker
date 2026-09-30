import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast
from urllib.parse import quote, urlsplit

import chess
import click
import requests
import sqlalchemy as sa
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.decoy_puzzle import DecoyPuzzle
from app.models.game import SourceGame as Game
from app.models.opening import Opening


PROGRESS_INTERVAL = 500
EXPECTED_SCHEMA_VERSION = 2
_META_URL = "https://raw.githubusercontent.com/gilbertbrandow/decoys/main/meta.json"

_REQUIRED_FIELDS = {"fen", "opponentMove", "acceptedMoves", "bestCp", "depth", "moveNumber", "game_moves"}


def check_schema_version() -> None:
    try:
        meta = requests.get(_META_URL, timeout=10).json()
    except Exception as exc:
        click.echo(f"Warning: could not fetch decoys meta.json ({exc}). Skipping schema version check.")
        return
    remote = meta.get("schemaVersion")
    if remote != EXPECTED_SCHEMA_VERSION:
        raise SystemExit(
            f"Decoy schema version mismatch: importer expects v{EXPECTED_SCHEMA_VERSION}, "
            f"generator repo reports v{remote}. "
            f"Check https://github.com/gilbertbrandow/decoys for breaking changes."
        )


@dataclass
class ImportBatchResult:
    imported: int
    skipped_existing: int


def _safe_int(val: Any) -> int | None:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _lichess_id_from_url(url: str) -> str | None:
    """Extract bare game ID from a Lichess URL (strips /side suffix and #fragment)."""
    try:
        parts = [p for p in urlsplit(url).path.split("/") if p]
        return parts[0] if parts else None
    except (AttributeError, ValueError):
        return None


def _build_analysis_url(fen: str, opponent_move: str) -> str:
    """Return a Lichess analysis URL pointing to the position the player must solve."""
    try:
        parts = fen.split()
        full_fen = fen if len(parts) == 6 else f"{fen} 0 1"
        board = chess.Board(full_fen)
        board.push_uci(opponent_move)
        return f"https://lichess.org/analysis/{quote(board.fen(), safe='/')}"
    except Exception:
        return f"https://lichess.org/analysis/{quote(fen, safe='/')}"


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
        candidates = by_eco.get(eco, [])
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
    """Upsert SourceGame rows from JSONL items. Returns fen → game.id for all items.

    Two groups:
      Online (lichessGameUrl present): deduplicated by lichess_id, upserted with
        on_conflict_do_nothing so concurrent imports never raise IntegrityError.
      OTB (no lichessGameUrl but game_moves present): deduplicated by
        (white, black, event, date) since these are real-world games with no Lichess ID.
    """
    fen_to_game_id: dict[str, int] = {}

    # ── Online games ──────────────────────────────────────────────────────────
    # Deduplicate within the batch by lichess_id; first occurrence wins for game data.
    lichess_id_to_item: dict[str, dict[str, Any]] = {}
    lichess_id_to_fens: dict[str, list[str]] = {}
    for item in items:
        url = item.get("lichessGameUrl")
        if not url:
            continue
        gid = _lichess_id_from_url(url)
        if not gid:
            continue
        lichess_id_to_item.setdefault(gid, item)
        lichess_id_to_fens.setdefault(gid, []).append(item["fen"])

    if lichess_id_to_item:
        existing = {
            row.lichess_id: row.id
            for row in session.execute(
                select(Game.lichess_id, Game.id)
                .where(Game.lichess_id.in_(lichess_id_to_item.keys()))
            ).all()
        }
        new_rows: list[dict[str, Any]] = []
        for lichess_id, item in lichess_id_to_item.items():
            if lichess_id in existing:
                continue
            moves_uci = item.get("game_moves")
            if not moves_uci:
                click.echo(f"Warning: skipping game {lichess_id}: missing game_moves")
                continue
            new_rows.append({
                "lichess_id": lichess_id,
                "moves": moves_uci,
                "white": item.get("white", "?"),
                "black": item.get("black", "?"),
                "white_elo": _safe_int(item.get("whiteElo")),
                "black_elo": _safe_int(item.get("blackElo")),
                "white_title": item.get("whiteTitle"),
                "black_title": item.get("blackTitle"),
                "event": item.get("event"),
                "date": item.get("date"),
                "eco": item.get("eco"),
                "opening_id": _find_opening_id(
                    item.get("eco"), item.get("openingName"),
                    opening_by_display_name, opening_by_eco,
                ),
                "source_import_run_id": source_import_run_id,
            })
        if new_rows:
            inserted = session.execute(
                pg_insert(cast(sa.Table, Game.__table__))
                .values(new_rows)
                .on_conflict_do_nothing(index_elements=["lichess_id"])
                .returning(Game.__table__.c.id, Game.__table__.c.lichess_id)
            ).all()
            session.flush()
            for row in inserted:
                existing[row.lichess_id] = row.id
            # Re-query any IDs that on_conflict_do_nothing silenced (already existed)
            missing = [gid for gid in lichess_id_to_item if gid not in existing]
            if missing:
                for row in session.execute(
                    select(Game.lichess_id, Game.id).where(Game.lichess_id.in_(missing))
                ).all():
                    existing[row.lichess_id] = row.id

        for lichess_id, fens in lichess_id_to_fens.items():
            db_id = existing.get(lichess_id)
            if db_id:
                for fen in fens:
                    fen_to_game_id[fen] = db_id

    # ── OTB games (no lichessGameUrl, have game_moves) ────────────────────────
    # Deduplicate by (white, black, event, date) — multiple puzzles from the same
    # OTB game should all point to the same SourceGame row.
    OtbKey = tuple[str | None, str | None, str | None, str | None]
    otb_key_to_item: dict[OtbKey, dict[str, Any]] = {}
    otb_key_to_fens: dict[OtbKey, list[str]] = {}
    for item in items:
        if item.get("lichessGameUrl") or not item.get("game_moves"):
            continue
        key: OtbKey = (
            item.get("white"), item.get("black"),
            item.get("event"), item.get("date"),
        )
        otb_key_to_item.setdefault(key, item)
        otb_key_to_fens.setdefault(key, []).append(item["fen"])

    for key, item in otb_key_to_item.items():
        white, black, event, date = key
        existing_id = session.execute(
            select(Game.id).where(
                Game.lichess_id.is_(None),
                Game.white == (white or "?"),
                Game.black == (black or "?"),
                Game.event == event,
                Game.date == date,
            )
        ).scalar_one_or_none()
        if existing_id:
            db_id = existing_id
        else:
            new_game = Game(
                lichess_id=None,
                moves=item["game_moves"],
                white=white or "?",
                black=black or "?",
                white_elo=_safe_int(item.get("whiteElo")),
                black_elo=_safe_int(item.get("blackElo")),
                white_title=item.get("whiteTitle"),
                black_title=item.get("blackTitle"),
                event=event,
                date=date,
                eco=item.get("eco"),
                opening_id=_find_opening_id(
                    item.get("eco"), item.get("openingName"),
                    opening_by_display_name, opening_by_eco,
                ),
                source_import_run_id=source_import_run_id,
            )
            session.add(new_game)
            session.flush()
            db_id = new_game.id

        for fen in otb_key_to_fens[key]:
            fen_to_game_id[fen] = db_id

    return fen_to_game_id


def process_batch(
    session: Session,
    batch: list[dict[str, Any]],
    source_import_run_id: int,
    opening_by_display_name: dict[str, int],
    opening_by_eco: dict[str, list[tuple[int, str]]],
    api_token: str | None = None,
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

    decoy_rows: list[dict[str, Any]] = []
    for item in new_items:
        ti_id = session.execute(
            sa.text(
                "INSERT INTO training_items (source_type, source_import_run_id) "
                "VALUES ('DECOY', :run_id) RETURNING id"
            ),
            {"run_id": source_import_run_id},
        ).scalar_one()
        game_id = game_id_map.get(item["fen"])
        analysis_url = _build_analysis_url(item["fen"], item["opponentMove"])
        decoy_rows.append({
            "training_item_id": ti_id,
            "fen": item["fen"],
            "opponent_move": item["opponentMove"],
            "accepted_moves": item["acceptedMoves"],
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
    api_token: str | None = None,
) -> dict[str, Any]:
    check_schema_version()
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

            accepted_moves = item["acceptedMoves"]
            if not isinstance(accepted_moves, list) or not accepted_moves:
                rows_malformed += 1
                click.echo(
                    f"Warning: skipping record {rows_read + rows_malformed}: "
                    f"acceptedMoves must be a non-empty list, got {type(accepted_moves).__name__}"
                )
                continue

            rows_read += 1
            pending.append(item)

            if len(pending) >= batch_size:
                result = process_batch(
                    session, pending, source_import_run_id,
                    opening_by_display_name, opening_by_eco, api_token,
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
