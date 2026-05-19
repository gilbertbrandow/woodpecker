from sqlalchemy import func, select, exists
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.opening import Opening
from app.models.scraped_positional_difficulty import ScrapedPositionalDifficulty
from app.models.scraped_positional_puzzle import (
    ScrapedPositionalPuzzle,
    scraped_positional_theme_links,
)
from app.models.scraped_positional_theme import ScrapedPositionalTheme
from app.models.source_import_run import (
    ScrapedPositionalSourceRunMetadata,
    SourceImportRun,
    SourceImportSource,
    SourceImportStatus,
)

ITEMS_PAGE_SIZE = 20


def _serialize_puzzle(p: ScrapedPositionalPuzzle) -> dict:
    return {
        "internalId": p.internal_id,
        "lichessUrl": p.lichess_url,
        "difficulty": {
            "value": p.difficulty.value,
            "label": p.difficulty.label,
            "minRating": p.difficulty.min_rating,
            "maxRating": p.difficulty.max_rating,
        },
        "themes": [{"name": th.name, "displayName": th.display_name} for th in p.themes],
        "opening": (
            {"name": p.opening.name, "displayName": p.opening.display_name, "eco": p.opening.eco}
            if p.opening
            else None
        ),
    }


def list_items(page: int, difficulty_value: int | None, theme_name: str | None, opening_name: str | None) -> dict:
    conditions = []

    if difficulty_value is not None:
        difficulty_id_subq = (
            select(ScrapedPositionalDifficulty.id)
            .where(ScrapedPositionalDifficulty.value == difficulty_value)
            .scalar_subquery()
        )
        conditions.append(ScrapedPositionalPuzzle.difficulty_id == difficulty_id_subq)

    if theme_name:
        conditions.append(
            exists(
                select(scraped_positional_theme_links.c.positional_puzzle_id)
                .join(
                    ScrapedPositionalTheme,
                    ScrapedPositionalTheme.id == scraped_positional_theme_links.c.positional_theme_id,
                )
                .where(
                    scraped_positional_theme_links.c.positional_puzzle_id == ScrapedPositionalPuzzle.id,
                    ScrapedPositionalTheme.name == theme_name,
                )
            )
        )

    if opening_name:
        opening_id_subq = (
            select(Opening.id)
            .where(Opening.name == opening_name)
            .scalar_subquery()
        )
        conditions.append(ScrapedPositionalPuzzle.opening_id == opening_id_subq)

    total: int = db.session.execute(
        select(func.count()).select_from(ScrapedPositionalPuzzle).where(*conditions)
    ).scalar_one()

    offset = (page - 1) * ITEMS_PAGE_SIZE
    puzzles = list(
        db.session.execute(
            select(ScrapedPositionalPuzzle)
            .where(*conditions)
            .options(
                selectinload(ScrapedPositionalPuzzle.difficulty),
                selectinload(ScrapedPositionalPuzzle.themes),
                selectinload(ScrapedPositionalPuzzle.opening),
            )
            .order_by(ScrapedPositionalPuzzle.id)
            .limit(ITEMS_PAGE_SIZE)
            .offset(offset)
        ).scalars()
    )

    total_pages = max(1, (total + ITEMS_PAGE_SIZE - 1) // ITEMS_PAGE_SIZE)

    return {
        "puzzles": [_serialize_puzzle(p) for p in puzzles],
        "page": page,
        "pageSize": ITEMS_PAGE_SIZE,
        "totalPages": total_pages,
        "total": total,
    }


def get_latest_source_run_metadata() -> dict | None:
    row = db.session.execute(
        select(ScrapedPositionalSourceRunMetadata)
        .join(
            SourceImportRun,
            SourceImportRun.id == ScrapedPositionalSourceRunMetadata.source_import_run_id,
        )
        .where(
            SourceImportRun.source == SourceImportSource.SCRAPED_POSITIONAL,
            SourceImportRun.status == SourceImportStatus.SUCCEEDED,
        )
        .order_by(SourceImportRun.finished_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if row is None:
        return None

    difficulty_rows = list(
        db.session.execute(
            select(ScrapedPositionalDifficulty).order_by(ScrapedPositionalDifficulty.value)
        ).scalars()
    )
    difficulty_counts = [
        {
            "value": d.value,
            "label": d.label,
            "description": d.description,
            "minRating": d.min_rating,
            "maxRating": d.max_rating,
            "count": int(row.difficulty_counts_json.get(str(d.value), 0)),
        }
        for d in difficulty_rows
    ]

    top_theme_items = sorted(
        row.theme_counts_json.items(), key=lambda x: x[1], reverse=True
    )[:13]
    top_theme_names = [name for name, _ in top_theme_items]
    theme_rows = (
        list(
            db.session.execute(
                select(ScrapedPositionalTheme).where(ScrapedPositionalTheme.name.in_(top_theme_names))
            ).scalars()
        )
        if top_theme_names
        else []
    )
    theme_meta = {r.name: (r.display_name, r.description) for r in theme_rows}
    themes = [
        {
            "name": name,
            "displayName": theme_meta.get(name, (name, ""))[0] or name,
            "description": theme_meta.get(name, ("", ""))[1] or "",
            "count": int(count),
        }
        for name, count in top_theme_items
    ]

    return {
        "totalPositionalAfterRun": row.total_positional_after_run,
        "difficultyCounts": difficulty_counts,
        "themes": themes,
        "generatedAt": row.generated_at.isoformat(),
    }
