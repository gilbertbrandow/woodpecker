import csv
import io
import time
from typing import IO

import click
import zstandard
from flask.cli import AppGroup
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.extensions import db
from app.models.puzzle import Puzzle, puzzle_themes, puzzle_openings
from app.models.theme import Theme
from app.models.opening import Opening

puzzles_cli = AppGroup("puzzles")

PROGRESS_INTERVAL = 10_000


def _load_cache(model: type[Theme] | type[Opening]) -> dict[str, int]:
    rows = db.session.execute(db.select(model.name, model.id)).all()
    return {name: id_ for name, id_ in rows}


def _flush_new_names(names: set[str], model: type[Theme] | type[Opening], cache: dict[str, int]) -> None:
    new = names - cache.keys()
    if not new:
        return
    stmt = pg_insert(model.__table__).values([{"name": n} for n in new]).on_conflict_do_nothing(
        index_elements=["name"]
    )
    db.session.execute(stmt)
    db.session.commit()
    fresh = db.session.execute(
        db.select(model.name, model.id).where(model.name.in_(new))
    ).all()
    for name, id_ in fresh:
        cache[name] = id_


def _open_stream(file_path: str) -> tuple[IO, IO]:
    if file_path.endswith(".zst"):
        fh = open(file_path, "rb")
        dctx = zstandard.ZstdDecompressor()
        return dctx.stream_reader(fh), fh
    raw = open(file_path, "r", encoding="utf-8", newline="")
    return raw, raw


@puzzles_cli.command("import")
@click.option("--file", "file_path", required=True, type=click.Path(exists=True), help="Path to Lichess puzzle file (.csv or .csv.zst)")
@click.option("--limit", default=None, type=int, help="Maximum number of puzzles to insert")
@click.option("--min-rating", default=0, type=int, help="Skip puzzles below this rating")
@click.option("--max-rating", default=9999, type=int, help="Skip puzzles above this rating")
@click.option("--batch-size", default=500, type=int, help="Rows per database batch")
def import_puzzles(
    file_path: str,
    limit: int | None,
    min_rating: int,
    max_rating: int,
    batch_size: int,
) -> None:
    start = time.monotonic()
    rows_read = 0
    rows_inserted = 0
    rows_skipped = 0

    theme_cache: dict[str, int] = _load_cache(Theme)
    opening_cache: dict[str, int] = _load_cache(Opening)

    puzzle_batch: list[dict] = []
    batch_themes: list[list[str]] = []
    batch_openings: list[list[str]] = []

    def flush() -> int:
        if not puzzle_batch:
            return 0

        batch_theme_names: set[str] = set()
        batch_opening_names: set[str] = set()
        for t_list in batch_themes:
            batch_theme_names.update(t_list)
        for o_list in batch_openings:
            batch_opening_names.update(o_list)

        _flush_new_names(batch_theme_names, Theme, theme_cache)
        _flush_new_names(batch_opening_names, Opening, opening_cache)

        stmt = pg_insert(Puzzle.__table__).values(puzzle_batch).on_conflict_do_nothing(
            index_elements=["puzzle_id"]
        )
        result = db.session.execute(stmt)
        db.session.commit()

        inserted_count = result.rowcount if result.rowcount >= 0 else 0

        if inserted_count > 0:
            puzzle_id_map = {
                row.puzzle_id: row.id for row in db.session.execute(
                    db.select(Puzzle.puzzle_id, Puzzle.id).where(
                        Puzzle.puzzle_id.in_([p["puzzle_id"] for p in puzzle_batch])
                    )
                ).all()
            }

            theme_assoc: list[dict] = []
            opening_assoc: list[dict] = []

            for puzzle_row, t_list, o_list in zip(puzzle_batch, batch_themes, batch_openings):
                pid = puzzle_id_map.get(puzzle_row["puzzle_id"])
                if pid is None:
                    continue
                for t in t_list:
                    tid = theme_cache.get(t)
                    if tid is not None:
                        theme_assoc.append({"puzzle_id": pid, "theme_id": tid})
                for o in o_list:
                    oid = opening_cache.get(o)
                    if oid is not None:
                        opening_assoc.append({"puzzle_id": pid, "opening_id": oid})

            if theme_assoc:
                db.session.execute(
                    pg_insert(puzzle_themes).values(theme_assoc).on_conflict_do_nothing()
                )
            if opening_assoc:
                db.session.execute(
                    pg_insert(puzzle_openings).values(opening_assoc).on_conflict_do_nothing()
                )
            db.session.commit()

        puzzle_batch.clear()
        batch_themes.clear()
        batch_openings.clear()
        return inserted_count

    stream, fh = _open_stream(file_path)
    try:
        if file_path.endswith(".zst"):
            text_stream: IO = io.TextIOWrapper(stream, encoding="utf-8", newline="")
        else:
            text_stream = stream

        reader = csv.DictReader(text_stream)
        for row in reader:
            rows_read += 1

            rating = int(row["Rating"])
            if rating < min_rating or rating > max_rating:
                rows_skipped += 1
            else:
                puzzle_batch.append({
                    "puzzle_id": row["PuzzleId"],
                    "fen": row["FEN"],
                    "moves": row["Moves"],
                    "rating": rating,
                    "rating_deviation": int(row["RatingDeviation"]),
                    "popularity": int(row["Popularity"]),
                    "nb_plays": int(row["NbPlays"]),
                    "game_url": row["GameUrl"],
                })
                batch_themes.append(row["Themes"].split() if row["Themes"] else [])
                batch_openings.append(row["OpeningTags"].split() if row["OpeningTags"] else [])

                if len(puzzle_batch) >= batch_size:
                    rows_inserted += flush()

                    if limit is not None and rows_inserted >= limit:
                        break

            if rows_read % PROGRESS_INTERVAL == 0:
                click.echo(f"Read {rows_read} | Inserted {rows_inserted} | Skipped {rows_skipped}")

        rows_inserted += flush()
    finally:
        fh.close()

    elapsed = time.monotonic() - start
    click.echo(f"\nDone. Inserted: {rows_inserted} | Skipped: {rows_skipped} | Time: {elapsed:.1f}s")
