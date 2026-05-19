import csv
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

from app.models.opening import Opening
from app.models.scraped_positional_difficulty import ScrapedPositionalDifficulty
from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle, scraped_positional_theme_links
from app.models.scraped_positional_theme import ScrapedPositionalTheme
from sources.scraped_positional.enrichment import OPENING_PLY_CUTOFF, enrich_batch
from sources.scraped_positional.theme_seeder import THEME_COLUMN_NAMES

PROGRESS_INTERVAL = 500


@dataclass
class PuzzleBatchResult:
    imported: int
    skipped_existing: int
    enrichment_failures: int


def _load_opening_caches(session: Session) -> tuple[dict[str, int], dict[str, list[tuple[int, str]]]]:
    rows = session.execute(select(Opening.id, Opening.eco, Opening.display_name)).all()
    by_display_name: dict[str, int] = {}
    by_eco: dict[str, list[tuple[int, str]]] = {}
    for id_, eco, display_name in rows:
        by_display_name[display_name] = id_
        by_eco.setdefault(eco, []).append((id_, display_name))
    return by_display_name, by_eco


def _find_opening_id(
    opening_data: dict[str, Any],
    by_display_name: dict[str, int],
    by_eco: dict[str, list[tuple[int, str]]],
) -> int | None:
    name = opening_data.get("name", "")
    eco = opening_data.get("eco", "")
    if name in by_display_name:
        return by_display_name[name]
    candidates = by_eco.get(eco, [])
    click.echo(
        f"Warning: no display_name match for opening {name!r} (ECO {eco!r}), "
        f"{len(candidates)} ECO candidate(s) — skipping"
    )
    return None


def _check_prerequisites(session: Session) -> None:
    difficulty_count = session.scalar(select(func.count()).select_from(ScrapedPositionalDifficulty))
    theme_count = session.scalar(select(func.count()).select_from(ScrapedPositionalTheme))
    if not difficulty_count:
        raise SystemExit(
            "ERROR: scraped_positional_difficulties table is empty. "
            "Run 'positional difficulties import' first."
        )
    if not theme_count:
        raise SystemExit(
            "ERROR: scraped_positional_themes table is empty. "
            "Run 'positional themes import' first."
        )


def _load_difficulty_cache(session: Session) -> dict[int, int]:
    rows = session.execute(
        select(ScrapedPositionalDifficulty.value, ScrapedPositionalDifficulty.id)
    ).all()
    return {value: id_ for value, id_ in rows}


def _load_theme_cache(session: Session) -> dict[str, int]:
    rows = session.execute(select(ScrapedPositionalTheme.name, ScrapedPositionalTheme.id)).all()
    return {name: id_ for name, id_ in rows}


def process_puzzle_batch(
    session: Session,
    batch: list[dict[str, Any]],
    source_import_run_id: int,
    difficulty_cache: dict[int, int],
    theme_cache: dict[str, int],
    opening_by_display_name: dict[str, int],
    opening_by_eco: dict[str, list[tuple[int, str]]],
    api_token: str | None,
) -> PuzzleBatchResult:
    if not batch:
        return PuzzleBatchResult(imported=0, skipped_existing=0, enrichment_failures=0)

    internal_ids = [p["internal_id"] for p in batch]
    existing_ids: set[int] = set(
        session.scalars(
            select(ScrapedPositionalPuzzle.internal_id).where(
                ScrapedPositionalPuzzle.internal_id.in_(internal_ids)
            )
        ).all()
    )

    new_puzzles = [p for p in batch if p["internal_id"] not in existing_ids]
    skipped_existing = len(batch) - len(new_puzzles)

    if not new_puzzles:
        return PuzzleBatchResult(imported=0, skipped_existing=skipped_existing, enrichment_failures=0)

    enriched = enrich_batch(new_puzzles, api_token)

    enrichment_failures = 0
    insertable: list[dict[str, Any]] = []
    insertable_themes: list[list[str]] = []
    for puzzle, result in zip(new_puzzles, enriched):
        if result is None:
            enrichment_failures += 1
            continue
        enriched_fen, moves_str, opening_data = result
        difficulty_id = difficulty_cache.get(puzzle["difficulty"])
        if difficulty_id is None:
            click.echo(f"Warning: unknown difficulty value {puzzle['difficulty']!r}, skipping puzzle {puzzle['internal_id']}")
            enrichment_failures += 1
            continue
        if opening_data is None and puzzle["move_number"] <= OPENING_PLY_CUTOFF:
            click.echo(
                f"Warning: puzzle {puzzle['internal_id']} at ply {puzzle['move_number']} "
                f"(within cutoff) — Lichess returned no opening for game {puzzle['lichess_game_id']}"
            )
        opening_id = _find_opening_id(opening_data, opening_by_display_name, opening_by_eco) if opening_data else None
        insertable.append({
            "internal_id": puzzle["internal_id"],
            "lichess_url": puzzle["lichess_url"],
            "fen": enriched_fen,
            "moves": moves_str,
            "difficulty_id": difficulty_id,
            "opening_id": opening_id,
        })
        insertable_themes.append(puzzle["themes"])

    if not insertable:
        return PuzzleBatchResult(imported=0, skipped_existing=skipped_existing, enrichment_failures=enrichment_failures)

    n = len(insertable)
    ti_result = cast(
        CursorResult[Any],
        session.execute(
            sa.text(
                "INSERT INTO training_items (source_type, source_import_run_id) "
                "SELECT 'SCRAPED_POSITIONAL', :run_id FROM generate_series(1, :n) "
                "RETURNING id"
            ),
            {"n": n, "run_id": source_import_run_id},
        ),
    )
    new_ti_ids = [row.id for row in ti_result]

    puzzle_rows = [
        {**p, "training_item_id": new_ti_ids[i]}
        for i, p in enumerate(insertable)
    ]
    puzzle_result = cast(
        CursorResult[Any],
        session.execute(
            pg_insert(cast(sa.Table, ScrapedPositionalPuzzle.__table__))
            .values(puzzle_rows)
            .on_conflict_do_nothing(index_elements=["internal_id"])
            .returning(ScrapedPositionalPuzzle.__table__.c.id, ScrapedPositionalPuzzle.__table__.c.internal_id)
        ),
    )
    inserted_puzzle_map: dict[int, int] = {row.internal_id: row.id for row in puzzle_result}
    session.commit()

    theme_links: list[dict[str, int]] = []
    for puzzle_data, theme_names in zip(insertable, insertable_themes):
        puzzle_id = inserted_puzzle_map.get(puzzle_data["internal_id"])
        if puzzle_id is None:
            continue
        for theme_name in theme_names:
            theme_id = theme_cache.get(theme_name)
            if theme_id is not None:
                theme_links.append({"positional_puzzle_id": puzzle_id, "positional_theme_id": theme_id})

    if theme_links:
        session.execute(
            pg_insert(scraped_positional_theme_links).values(theme_links).on_conflict_do_nothing()
        )
        session.commit()

    return PuzzleBatchResult(
        imported=len(inserted_puzzle_map),
        skipped_existing=skipped_existing,
        enrichment_failures=enrichment_failures,
    )


def import_puzzles(
    session: Session,
    file: Path,
    source_import_run_id: int,
    api_token: str | None,
    limit: int | None,
    batch_size: int,
) -> dict[str, Any]:
    _check_prerequisites(session)

    difficulty_cache = _load_difficulty_cache(session)
    theme_cache = _load_theme_cache(session)
    opening_by_display_name, opening_by_eco = _load_opening_caches(session)

    start = time.monotonic()
    rows_read = 0
    rows_imported = 0
    rows_skipped_existing = 0
    enrichment_failures = 0

    pending: list[dict[str, Any]] = []

    with open(file, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows_read += 1
            theme_names = [col for col in THEME_COLUMN_NAMES if row.get(col) == "1"]
            pending.append({
                "internal_id": int(row["internal_id"]),
                "lichess_game_id": row["lichess_game_id"],
                "move_number": int(row["move_number"]),
                "lichess_url": row["lichess_url"],
                "best_move": row["best_move"],
                "difficulty": int(row["difficulty"]),
                "themes": theme_names,
            })

            if len(pending) >= batch_size:
                batch_result = process_puzzle_batch(
                    session, pending, source_import_run_id, difficulty_cache, theme_cache,
                    opening_by_display_name, opening_by_eco, api_token
                )
                pending.clear()
                rows_imported += batch_result.imported
                rows_skipped_existing += batch_result.skipped_existing
                enrichment_failures += batch_result.enrichment_failures
                if limit is not None and rows_imported >= limit:
                    break

            if rows_read % PROGRESS_INTERVAL == 0:
                click.echo(
                    f"Read {rows_read:,} | Imported {rows_imported:,} | "
                    f"Skipped {rows_skipped_existing:,} | Failures {enrichment_failures:,}"
                )

    if pending:
        batch_result = process_puzzle_batch(
            session, pending, source_import_run_id, difficulty_cache, theme_cache,
            opening_by_display_name, opening_by_eco, api_token
        )
        rows_imported += batch_result.imported
        rows_skipped_existing += batch_result.skipped_existing
        enrichment_failures += batch_result.enrichment_failures

    elapsed = time.monotonic() - start
    click.echo(
        f"\nDone. Imported: {rows_imported:,} | Skipped existing: {rows_skipped_existing:,} | "
        f"Enrichment failures: {enrichment_failures:,} | Time: {elapsed:.1f}s"
    )

    total_after = session.scalar(select(func.count()).select_from(ScrapedPositionalPuzzle)) or 0

    difficulty_rows = session.execute(
        sa_text("""
            SELECT d.value, COUNT(sp.id) AS cnt
            FROM scraped_positional_puzzles sp
            JOIN training_items ti ON ti.id = sp.training_item_id
            JOIN scraped_positional_difficulties d ON d.id = sp.difficulty_id
            WHERE ti.source_import_run_id = :run_id
            GROUP BY d.value
            ORDER BY d.value
        """),
        {"run_id": source_import_run_id},
    ).all()
    difficulty_counts = {str(r.value): int(r.cnt) for r in difficulty_rows}

    theme_rows = session.execute(
        sa_text("""
            SELECT t.name, COUNT(*) AS cnt
            FROM scraped_positional_theme_links stl
            JOIN scraped_positional_themes t ON t.id = stl.positional_theme_id
            JOIN scraped_positional_puzzles sp ON sp.id = stl.positional_puzzle_id
            JOIN training_items ti ON ti.id = sp.training_item_id
            WHERE ti.source_import_run_id = :run_id
            GROUP BY t.name
        """),
        {"run_id": source_import_run_id},
    ).all()
    theme_counts = {r.name: int(r.cnt) for r in theme_rows}

    return {
        "total_rows_seen": rows_read,
        "imported_count": rows_imported,
        "skipped_existing_count": rows_skipped_existing,
        "enrichment_failures_count": enrichment_failures,
        "total_positional_after_run": total_after,
        "difficulty_counts": difficulty_counts,
        "theme_counts": theme_counts,
    }
