from typing import cast

import click
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.scraped_positional_difficulty import ScrapedPositionalDifficulty

DIFFICULTIES = [
    {
        "value": 1,
        "label": "Easy",
        "description": "Foundational positional concepts suitable for club players.",
        "min_rating": 1200,
        "max_rating": 1500,
    },
    {
        "value": 2,
        "label": "Moderate",
        "description": "Intermediate positional ideas for improving players.",
        "min_rating": 1500,
        "max_rating": 1800,
    },
    {
        "value": 3,
        "label": "Hard",
        "description": "Advanced positional concepts for strong club players.",
        "min_rating": 1800,
        "max_rating": 2000,
    },
    {
        "value": 4,
        "label": "Very Hard",
        "description": "Expert-level positional ideas for high-level players.",
        "min_rating": 2000,
        "max_rating": None,
    },
]


def seed_difficulties(session: Session) -> None:
    table = cast(sa.Table, ScrapedPositionalDifficulty.__table__)
    stmt = (
        pg_insert(table)
        .values(DIFFICULTIES)
        .on_conflict_do_update(
            index_elements=["value"],
            set_={
                "label": pg_insert(table).excluded.label,
                "description": pg_insert(table).excluded.description,
                "min_rating": pg_insert(table).excluded.min_rating,
                "max_rating": pg_insert(table).excluded.max_rating,
            },
        )
    )
    session.execute(stmt)
    session.commit()
    click.echo(f"Upserted {len(DIFFICULTIES)} difficulties.")
