from sqlalchemy import func, select, exists, text
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.lichess_tactic import (
    LichessTactic,
    lichess_tactic_openings,
    lichess_tactic_theme_links,
)
from app.models.lichess_tactic_theme import LichessTacticTheme
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
