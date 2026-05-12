import csv
import io
import time
from pathlib import Path
from typing import IO, Any, cast
from urllib.parse import urlsplit, urlunsplit

import click
import sqlalchemy as sa
import zstandard
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session

from app.models.lichess_tactic import LichessTactic, lichess_tactic_theme_links, lichess_tactic_openings
from app.models.lichess_tactic_theme import LichessTacticTheme
from app.models.opening import Opening

PROGRESS_INTERVAL = 10_000

# Lichess puzzles CSV uses different opening names than the chess-openings TSV in some cases.
# These aliases map puzzle tags to the equivalent DB key so they resolve without fuzzy matching.
OPENING_ALIASES: dict[str, str] = {
    # Russian Game = Petrov's Defense (same opening, different naming convention)
    "Russian_Game": "Petrovs_Defense",
    "Russian_Game_Classical_Attack": "Petrovs_Defense_Classical_Attack",
    "Russian_Game_Cochrane_Gambit": "Petrovs_Defense_Cochrane_Gambit",
    "Russian_Game_Cozio_Attack": "Petrovs_Defense_Cozio_Attack",
    "Russian_Game_Damiano_Variation": "Petrovs_Defense_Damiano_Variation",
    "Russian_Game_French_Attack": "Petrovs_Defense_French_Attack",
    "Russian_Game_Italian_Variation": "Petrovs_Defense_Italian_Variation",
    "Russian_Game_Karklins-Martinovsky_Variation": "Petrovs_Defense_Karklins-Martinovsky_Variation",
    "Russian_Game_Millennium_Attack": "Petrovs_Defense_Millennium_Attack",
    "Russian_Game_Modern_Attack": "Petrovs_Defense_Modern_Attack",
    "Russian_Game_Nimzowitsch_Attack": "Petrovs_Defense_Nimzowitsch_Attack",
    "Russian_Game_Other_variations": "Petrovs_Defense",
    "Russian_Game_Paulsen_Attack": "Petrovs_Defense_Paulsen_Attack",
    "Russian_Game_Stafford_Gambit": "Petrovs_Defense_Stafford_Gambit",
    "Russian_Game_Three_Knights_Game": "Petrovs_Defense_Three_Knights_Game",
    # Giuoco Piano is a variation under Italian Game in the TSV
    "Giuoco_Piano": "Italian_Game_Giuoco_Piano",
    "Giuoco_Piano_Other_variations": "Italian_Game_Giuoco_Piano",
    # Bronstein Gambit = Latvian Gambit Accepted: Bronstein Gambit (C40)
    "Bronstein_Gambit": "Latvian_Gambit_Accepted_Bronstein_Gambit",
    "Bronstein_Gambit_Other_variations": "Latvian_Gambit_Accepted_Bronstein_Gambit",
    # Guatemala Defense = Owen Defense: Guatemala Defense
    "Guatemala_Defense": "Owen_Defense_Guatemala_Defense",
    "Guatemala_Defense_Other_variations": "Owen_Defense_Guatemala_Defense",
    # Crab Opening = Ware Opening: Crab Variation
    "Crab_Opening": "Ware_Opening_Crab_Variation",
    "Crab_Opening_Other_variations": "Ware_Opening_Crab_Variation",
    # Gedult's Opening = Barnes Opening (both start with 1. f3)
    "Gedults_Opening": "Barnes_Opening",
    "Gedults_Opening_Other_variations": "Barnes_Opening",
}


def _player_oriented_game_url(game_url: str, fen: str) -> str:
    fen_parts = fen.split(" ")
    if len(fen_parts) < 2:
        return game_url
    side_to_move = fen_parts[1]
    if side_to_move not in {"w", "b"}:
        return game_url
    parsed = urlsplit(game_url)
    path_parts = [part for part in parsed.path.split("/") if part]
    if not path_parts:
        return game_url
    game_id = path_parts[0]
    wants_black = side_to_move == "w"
    normalized_path = f"/{game_id}/black" if wants_black else f"/{game_id}"
    return urlunsplit((parsed.scheme, parsed.netloc, normalized_path, parsed.query, parsed.fragment))


def _load_cache(session: Session, model: type[LichessTacticTheme] | type[Opening]) -> dict[str, int]:
    rows = session.execute(select(model.name, model.id)).all()
    return {name: id_ for name, id_ in rows}


def _fuzzy_match_opening(tag: str, opening_cache: dict[str, int]) -> int | None:
    """Return the id of the opening whose key shares the most consecutive leading
    underscore-words with *tag*.  At least 2 words must match.  Ties are broken
    by preferring the shorter (more general) DB key.
    """
    tag_words = tag.split("_")
    if len(tag_words) < 2:
        return None

    best_id: int | None = None
    best_match_len: int = 1       # must exceed this — i.e. >= 2 to qualify
    best_key_len: int = 999       # tie-break: shorter key = more general = preferred

    for db_key, db_id in opening_cache.items():
        db_words = db_key.split("_")
        match_len = 0
        for a, b in zip(tag_words, db_words):
            if a == b:
                match_len += 1
            else:
                break
        key_len = len(db_words)
        if match_len > best_match_len or (
            match_len == best_match_len and key_len < best_key_len
        ):
            best_match_len = match_len
            best_key_len = key_len
            best_id = db_id

    return best_id


def _open_stream(file: Path) -> tuple[IO[Any], IO[Any]]:
    if str(file).endswith(".zst"):
        fh = open(file, "rb")
        dctx = zstandard.ZstdDecompressor()
        return dctx.stream_reader(fh), fh
    raw = open(file, "r", encoding="utf-8", newline="")
    return raw, raw


def _check_prerequisites(session: Session) -> None:
    opening_count = session.scalar(select(func.count()).select_from(Opening))
    theme_count = session.scalar(select(func.count()).select_from(LichessTacticTheme))
    if not opening_count:
        raise SystemExit(
            "ERROR: openings table is empty. Run 'shared openings import' first."
        )
    if not theme_count:
        raise SystemExit(
            "ERROR: lichess_tactic_themes table is empty. Run 'lichess-tactics themes import' first."
        )


def import_tactics(
    session: Session,
    file: Path,
    limit: int | None = None,
    min_rating: int = 0,
    max_rating: int = 9999,
    batch_size: int = 500,
) -> None:
    _check_prerequisites(session)

    start = time.monotonic()
    rows_read = 0
    rows_inserted = 0
    rows_skipped = 0
    unknown_themes: set[str] = set()
    unknown_openings: set[str] = set()

    theme_cache: dict[str, int] = _load_cache(session, LichessTacticTheme)
    opening_cache: dict[str, int] = _load_cache(session, Opening)
    fuzzy_opening_cache: dict[str, int | None] = {}  # computed once per unique unknown tag

    tactic_batch: list[dict[str, Any]] = []
    batch_themes: list[list[str]] = []
    batch_openings: list[list[str]] = []

    def flush() -> int:
        if not tactic_batch:
            return 0

        tactic_puzzle_ids = [t["puzzle_id"] for t in tactic_batch]

        existing_rows = session.execute(
            select(LichessTactic.puzzle_id, LichessTactic.training_item_id).where(
                LichessTactic.puzzle_id.in_(tactic_puzzle_ids)
            )
        ).all()
        existing_map: dict[str, int] = {r.puzzle_id: r.training_item_id for r in existing_rows}

        new_tactics = [t for t in tactic_batch if t["puzzle_id"] not in existing_map]

        inserted_count = 0
        if new_tactics:
            ti_result = cast(
                CursorResult[Any],
                session.execute(
                    sa.text(
                        "INSERT INTO training_items (source_type) "
                        "SELECT 'LICHESS_TACTIC' FROM generate_series(1, :n) "
                        "RETURNING id"
                    ),
                    {"n": len(new_tactics)},
                ),
            )
            new_ids = [row.id for row in ti_result]

            lichess_tactic_rows = [
                {**tactic, "training_item_id": new_ids[i]}
                for i, tactic in enumerate(new_tactics)
            ]
            stmt = pg_insert(cast(sa.Table, LichessTactic.__table__)).values(lichess_tactic_rows).on_conflict_do_nothing(
                index_elements=["puzzle_id"]
            )
            result = cast(CursorResult[Any], session.execute(stmt))
            session.commit()
            inserted_count = result.rowcount if result.rowcount >= 0 else 0

        if inserted_count > 0:
            all_tactic_id_map = {
                row.puzzle_id: row.id
                for row in session.execute(
                    select(LichessTactic.puzzle_id, LichessTactic.id).where(
                        LichessTactic.puzzle_id.in_(tactic_puzzle_ids)
                    )
                ).all()
            }

            theme_assoc: list[dict[str, int]] = []
            opening_assoc: list[dict[str, int]] = []

            for tactic_row, t_list, o_list in zip(tactic_batch, batch_themes, batch_openings):
                tid = all_tactic_id_map.get(str(tactic_row["puzzle_id"]))
                if tid is None:
                    continue
                for t in t_list:
                    theme_id = theme_cache.get(t)
                    if theme_id is not None:
                        theme_assoc.append({"lichess_tactic_id": tid, "lichess_tactic_theme_id": theme_id})
                    else:
                        unknown_themes.add(t)
                for o in o_list:
                    lookup_key = OPENING_ALIASES.get(o, o)
                    oid = opening_cache.get(lookup_key)
                    if oid is None:
                        if o not in fuzzy_opening_cache:
                            fuzzy_opening_cache[o] = _fuzzy_match_opening(o, opening_cache)
                        oid = fuzzy_opening_cache[o]
                    if oid is not None:
                        opening_assoc.append({"lichess_tactic_id": tid, "opening_id": oid})
                    else:
                        unknown_openings.add(o)

            if theme_assoc:
                session.execute(
                    pg_insert(lichess_tactic_theme_links).values(theme_assoc).on_conflict_do_nothing()
                )
            if opening_assoc:
                session.execute(
                    pg_insert(lichess_tactic_openings).values(opening_assoc).on_conflict_do_nothing()
                )
            session.commit()

        tactic_batch.clear()
        batch_themes.clear()
        batch_openings.clear()
        return inserted_count

    stream, fh = _open_stream(file)
    try:
        text_stream: IO[str] = io.TextIOWrapper(stream, encoding="utf-8", newline="") if str(file).endswith(".zst") else stream
        reader = csv.DictReader(text_stream)

        for row in reader:
            rows_read += 1
            rating = int(row["Rating"])
            if rating < min_rating or rating > max_rating:
                rows_skipped += 1
            else:
                fen = row["FEN"]
                tactic_batch.append({
                    "puzzle_id": row["PuzzleId"],
                    "fen": fen,
                    "moves": row["Moves"],
                    "rating": rating,
                    "rating_deviation": int(row["RatingDeviation"]),
                    "popularity": int(row["Popularity"]),
                    "nb_plays": int(row["NbPlays"]),
                    "game_url": _player_oriented_game_url(row["GameUrl"], fen),
                })
                batch_themes.append(row["Themes"].split() if row["Themes"] else [])
                batch_openings.append(row["OpeningTags"].split() if row["OpeningTags"] else [])

                if len(tactic_batch) >= batch_size:
                    rows_inserted += flush()
                    if limit is not None and rows_inserted >= limit:
                        break

            if rows_read % PROGRESS_INTERVAL == 0:
                click.echo(f"Read {rows_read:,} | Inserted {rows_inserted:,} | Skipped {rows_skipped:,}")

        rows_inserted += flush()
    finally:
        fh.close()

    elapsed = time.monotonic() - start
    click.echo(f"\nDone. Inserted: {rows_inserted:,} | Skipped: {rows_skipped:,} | Time: {elapsed:.1f}s")

    if unknown_themes:
        click.echo(f"Warning: {len(unknown_themes)} unknown theme key(s): {', '.join(sorted(unknown_themes))}")
    if unknown_openings:
        click.echo(
            f"Note: {len(unknown_openings)} opening tag(s) could not be resolved (no exact or fuzzy match): "
            + ", ".join(sorted(unknown_openings))
        )
