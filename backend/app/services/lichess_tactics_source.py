from sqlalchemy import func, select, exists, text
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.lichess_tactic import (
    LichessTactic,
    lichess_tactic_openings,
    lichess_tactic_theme_links,
)
from app.models.lichess_tactic_theme import LichessTacticTheme
from app.models.source_import_run import (
    LichessTacticsSourceRunMetadata,
    SourceImportRun,
    SourceImportSource,
    SourceImportStatus,
)
from app.models.opening import Opening


def get_stats() -> dict:
    total: int = db.session.execute(
        select(func.count()).select_from(LichessTactic)
    ).scalar_one()

    if total == 0:
        return {
            "totalCount": 0,
            "withOpeningsCount": 0,
            "withOpeningsPct": 0.0,
            "withThemesCount": 0,
            "withThemesPct": 0.0,
        }

    with_openings: int = db.session.execute(
        select(func.count()).select_from(LichessTactic).where(
            exists(
                select(lichess_tactic_openings.c.lichess_tactic_id).where(
                    lichess_tactic_openings.c.lichess_tactic_id == LichessTactic.id
                )
            )
        )
    ).scalar_one()

    with_themes: int = db.session.execute(
        select(func.count()).select_from(LichessTactic).where(
            exists(
                select(lichess_tactic_theme_links.c.lichess_tactic_id).where(
                    lichess_tactic_theme_links.c.lichess_tactic_id == LichessTactic.id
                )
            )
        )
    ).scalar_one()

    return {
        "totalCount": total,
        "withOpeningsCount": with_openings,
        "withOpeningsPct": round(with_openings / total * 100, 1),
        "withThemesCount": with_themes,
        "withThemesPct": round(with_themes / total * 100, 1),
    }


RATING_BUCKET_SIZE = 50


def get_rating_distribution() -> list[dict]:
    rows = db.session.execute(
        select(
            (func.floor(LichessTactic.rating / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE).label("bucket_min"),
            func.count().label("cnt"),
        )
        .select_from(LichessTactic)
        .group_by(text("bucket_min"))
        .order_by(text("bucket_min"))
    ).all()

    if not rows:
        return []

    start = int(rows[0].bucket_min)
    end = int(rows[-1].bucket_min) + RATING_BUCKET_SIZE
    bucket_map = {int(r.bucket_min): int(r.cnt) for r in rows}

    return [
        {"min": b, "max": b + RATING_BUCKET_SIZE, "count": bucket_map.get(b, 0)}
        for b in range(start, end, RATING_BUCKET_SIZE)
    ]


ITEMS_PAGE_SIZE = 20


def _serialize_tactic(t: LichessTactic) -> dict:
    return {
        "puzzleId": t.puzzle_id,
        "rating": t.rating,
        "popularity": t.popularity,
        "nbPlays": t.nb_plays,
        "gameUrl": t.game_url,
        "themes": [{"name": th.name, "displayName": th.display_name} for th in t.themes],
        "openings": [{"name": o.name, "displayName": o.display_name, "eco": o.eco} for o in t.openings],
    }


def list_items(
    page: int,
    rating_min: int | None,
    rating_max: int | None,
    theme_name: str | None,
    opening_names: list[str],
) -> dict:
    conditions = []

    if rating_min is not None:
        conditions.append(LichessTactic.rating >= rating_min)
    if rating_max is not None:
        conditions.append(LichessTactic.rating <= rating_max)
    if theme_name:
        conditions.append(
            exists(
                select(lichess_tactic_theme_links.c.lichess_tactic_id)
                .join(LichessTacticTheme, LichessTacticTheme.id == lichess_tactic_theme_links.c.lichess_tactic_theme_id)
                .where(
                    lichess_tactic_theme_links.c.lichess_tactic_id == LichessTactic.id,
                    LichessTacticTheme.name == theme_name,
                )
            )
        )
    if opening_names:
        conditions.append(
            exists(
                select(lichess_tactic_openings.c.lichess_tactic_id)
                .join(Opening, Opening.id == lichess_tactic_openings.c.opening_id)
                .where(
                    lichess_tactic_openings.c.lichess_tactic_id == LichessTactic.id,
                    Opening.name.in_(opening_names),
                )
            )
        )

    total: int = db.session.execute(
        select(func.count()).select_from(LichessTactic).where(*conditions)
    ).scalar_one()

    offset = (page - 1) * ITEMS_PAGE_SIZE
    tactics = list(
        db.session.execute(
            select(LichessTactic)
            .where(*conditions)
            .options(
                selectinload(LichessTactic.themes),
                selectinload(LichessTactic.openings),
            )
            .order_by(LichessTactic.rating)
            .limit(ITEMS_PAGE_SIZE)
            .offset(offset)
        ).scalars()
    )

    total_pages = max(1, (total + ITEMS_PAGE_SIZE - 1) // ITEMS_PAGE_SIZE)

    return {
        "puzzles": [_serialize_tactic(t) for t in tactics],
        "page": page,
        "pageSize": ITEMS_PAGE_SIZE,
        "totalPages": total_pages,
        "total": total,
    }


TOP_THEMES_LIMIT = 25


def get_top_themes() -> list[dict]:
    rows = db.session.execute(
        select(
            LichessTacticTheme.name,
            LichessTacticTheme.display_name,
            LichessTacticTheme.description,
            func.count().label("cnt"),
        )
        .select_from(lichess_tactic_theme_links)
        .join(LichessTacticTheme, LichessTacticTheme.id == lichess_tactic_theme_links.c.lichess_tactic_theme_id)
        .group_by(LichessTacticTheme.id)
        .order_by(text("cnt DESC"))
        .limit(TOP_THEMES_LIMIT)
    ).all()

    return [
        {
            "name": r.name,
            "displayName": r.display_name,
            "description": r.description,
            "count": int(r.cnt),
        }
        for r in rows
    ]


def get_latest_source_run_metadata() -> dict | None:
    """Aggregate precomputed metadata across all succeeded Lichess tactics import runs.

    Each metadata row captures only the tactics imported in that specific run.
    This function merges all rows to produce a complete picture of the source.
    """
    rows = list(
        db.session.execute(
            select(LichessTacticsSourceRunMetadata)
            .join(
                SourceImportRun,
                SourceImportRun.id == LichessTacticsSourceRunMetadata.source_import_run_id,
            )
            .where(
                SourceImportRun.source == SourceImportSource.LICHESS_TACTICS,
                SourceImportRun.status == SourceImportStatus.SUCCEEDED,
            )
            .order_by(SourceImportRun.finished_at.desc())
        ).scalars()
    )

    if not rows:
        return None

    latest = rows[0]

    imported_count = sum(r.imported_count for r in rows)
    tactics_with_themes = sum(r.tactics_with_themes_count for r in rows)
    tactics_with_openings = sum(r.tactics_with_openings_count for r in rows)

    non_empty = [r for r in rows if r.imported_count > 0]
    min_rating = min((r.min_rating for r in non_empty), default=0)
    max_rating = max((r.max_rating for r in non_empty), default=0)

    weighted_sum = sum(r.average_rating * r.imported_count for r in non_empty if r.average_rating is not None)
    weighted_denom = sum(r.imported_count for r in non_empty if r.average_rating is not None)
    average_rating = int(weighted_sum / weighted_denom) if weighted_denom > 0 else None

    rating_bucket_counts: dict[str, int] = {}
    theme_counts: dict[str, int] = {}
    opening_counts: dict[str, int] = {}
    for r in rows:
        for k, v in (r.rating_bucket_counts_json or {}).items():
            rating_bucket_counts[k] = rating_bucket_counts.get(k, 0) + int(v)
        for k, v in (r.theme_counts_json or {}).items():
            theme_counts[k] = theme_counts.get(k, 0) + int(v)
        for k, v in (r.opening_counts_json or {}).items():
            opening_counts[k] = opening_counts.get(k, 0) + int(v)

    return {
        "latestSourceImportRunId": latest.source_import_run_id,
        "importedCount": imported_count,
        "totalTacticsAfterRun": latest.total_tactics_after_run,
        "tacticsWithThemesCount": tactics_with_themes,
        "tacticsWithOpeningsCount": tactics_with_openings,
        "minRating": min_rating,
        "maxRating": max_rating,
        "averageRating": average_rating,
        "ratingBucketCounts": rating_bucket_counts,
        "themeCounts": theme_counts,
        "openingCounts": opening_counts,
        "generatedAt": latest.generated_at.isoformat(),
    }
