from sqlalchemy import func, select, exists
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

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
from app.table_query import FilterList, SetFilter


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


def list_items(
    page: int,
    page_size: int,
    difficulty: FilterList,
    theme: SetFilter,
    opening: FilterList,
) -> dict:
    conditions: list[ColumnElement[bool]] = []

    if difficulty.int_values:
        difficulty_id_subq = (
            select(ScrapedPositionalDifficulty.id)
            .where(ScrapedPositionalDifficulty.value.in_(difficulty.int_values))
        )
        if difficulty.op == 'is_not':
            conditions.append(ScrapedPositionalPuzzle.difficulty_id.not_in(difficulty_id_subq))
        else:
            conditions.append(ScrapedPositionalPuzzle.difficulty_id.in_(difficulty_id_subq))

    if theme.is_set and theme.str_values:
        def _theme_subq(names: list[str]):
            return (
                select(scraped_positional_theme_links.c.positional_puzzle_id)
                .join(
                    ScrapedPositionalTheme,
                    ScrapedPositionalTheme.id == scraped_positional_theme_links.c.positional_theme_id,
                )
                .where(
                    scraped_positional_theme_links.c.positional_puzzle_id == ScrapedPositionalPuzzle.id,
                    ScrapedPositionalTheme.name.in_(names),
                )
            )
        if theme.op == 'overlaps':
            conditions.append(exists(_theme_subq(theme.str_values)))
        elif theme.op == 'disjoint':
            conditions.append(~exists(_theme_subq(theme.str_values)))
        elif theme.op == 'superset':
            for name in theme.str_values:
                conditions.append(exists(_theme_subq([name])))
        elif theme.op == 'subset':
            conditions.append(
                ~exists(
                    select(scraped_positional_theme_links.c.positional_puzzle_id)
                    .join(
                        ScrapedPositionalTheme,
                        ScrapedPositionalTheme.id == scraped_positional_theme_links.c.positional_theme_id,
                    )
                    .where(
                        scraped_positional_theme_links.c.positional_puzzle_id == ScrapedPositionalPuzzle.id,
                        ScrapedPositionalTheme.name.notin_(theme.str_values),
                    )
                )
            )

    opening_names = opening.str_values
    if opening_names:
        conditions.append(
            exists(
                select(Opening.id)
                .where(
                    Opening.id == ScrapedPositionalPuzzle.opening_id,
                    Opening.name.in_(opening_names),
                )
            )
        )

    total: int = db.session.execute(
        select(func.count()).select_from(ScrapedPositionalPuzzle).where(*conditions)
    ).scalar_one()

    offset = (page - 1) * page_size
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
            .limit(page_size)
            .offset(offset)
        ).scalars()
    )

    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "items": [_serialize_puzzle(p) for p in puzzles],
        "page": page,
        "pageSize": page_size,
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
