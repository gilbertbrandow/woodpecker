import csv
import io
import time
from pathlib import Path
from typing import IO, Any

import click
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.models.lichess_tactic import LichessTactic, lichess_tactic_openings
from app.models.opening import Opening
from sources.lichess_tactics.tactic_importer import (
    OPENING_ALIASES,
    PROGRESS_INTERVAL,
    _fuzzy_match_opening,
    _load_cache,
    _open_stream,
)


def relink_openings(session: Session, file: Path, batch_size: int = 500) -> None:
    """Upsert opening links for all tactics already in the DB.

    Safe to run against production: uses ON CONFLICT DO NOTHING, so existing
    correct links are untouched. Only adds rows that are missing.
    """
    opening_cache: dict[str, int] = _load_cache(session, Opening)
    fuzzy_opening_cache: dict[str, int | None] = {}
    unknown_openings: set[str] = set()

    click.echo("Loading tactic index from DB...")
    puzzle_id_to_tactic_id: dict[str, int] = {
        r.puzzle_id: r.id
        for r in session.execute(select(LichessTactic.puzzle_id, LichessTactic.id)).all()
    }
    click.echo(f"Loaded {len(puzzle_id_to_tactic_id):,} tactics.")

    start = time.monotonic()
    rows_read = 0
    tactics_processed = 0
    new_links = 0

    batch: list[dict[str, int]] = []

    def flush() -> int:
        if not batch:
            return 0
        result: CursorResult[Any] = session.execute(  # type: ignore[assignment]
            pg_insert(lichess_tactic_openings).values(batch).on_conflict_do_nothing()
        )
        session.commit()
        n = result.rowcount if result.rowcount >= 0 else 0
        batch.clear()
        return n

    stream, fh = _open_stream(file)
    try:
        text_stream: IO[Any] = (
            io.TextIOWrapper(stream, encoding="utf-8", newline="")
            if str(file).endswith(".zst")
            else stream
        )
        reader = csv.DictReader(text_stream)

        for row in reader:
            rows_read += 1
            puzzle_id = row["PuzzleId"]
            tid = puzzle_id_to_tactic_id.get(puzzle_id)
            if tid is None:
                if rows_read % PROGRESS_INTERVAL == 0:
                    click.echo(f"Read {rows_read:,} | Processed {tactics_processed:,} | New links {new_links:,}")
                continue

            tactics_processed += 1
            opening_tags = row["OpeningTags"].split() if row["OpeningTags"] else []
            for o in opening_tags:
                lookup_key = OPENING_ALIASES.get(o, o)
                oid = opening_cache.get(lookup_key)
                if oid is None:
                    if o not in fuzzy_opening_cache:
                        fuzzy_opening_cache[o] = _fuzzy_match_opening(o, opening_cache)
                    oid = fuzzy_opening_cache[o]
                if oid is not None:
                    batch.append({"lichess_tactic_id": tid, "opening_id": oid})
                else:
                    unknown_openings.add(o)

            if len(batch) >= batch_size:
                new_links += flush()

            if rows_read % PROGRESS_INTERVAL == 0:
                click.echo(f"Read {rows_read:,} | Processed {tactics_processed:,} | New links {new_links:,}")

        new_links += flush()
    finally:
        fh.close()

    elapsed = time.monotonic() - start
    click.echo(f"\nDone. New opening links added: {new_links:,} | Time: {elapsed:.1f}s")

    if unknown_openings:
        click.echo(
            f"Note: {len(unknown_openings)} opening tag(s) could not be resolved: "
            + ", ".join(sorted(unknown_openings))
        )
