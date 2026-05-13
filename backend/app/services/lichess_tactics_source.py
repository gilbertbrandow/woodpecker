from sqlalchemy import func, select, exists

from app.extensions import db
from app.models.lichess_tactic import (
    LichessTactic,
    lichess_tactic_openings,
    lichess_tactic_theme_links,
)


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
