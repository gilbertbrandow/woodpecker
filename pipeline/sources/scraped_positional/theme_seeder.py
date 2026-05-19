from typing import cast

import click
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.scraped_positional_theme import ScrapedPositionalTheme

# Column name in CSV → (display_name, description)
THEMES = [
    {
        "name": "initiative",
        "display_name": "Initiative",
        "description": "Maintaining pressure and keeping the opponent on the back foot.",
    },
    {
        "name": "development",
        "display_name": "Piece Development",
        "description": "Mobilising pieces efficiently to reach optimal squares.",
    },
    {
        "name": "endgame",
        "display_name": "Endgame Technique",
        "description": "Precise technique to convert or hold an endgame position.",
    },
    {
        "name": "space",
        "display_name": "Gaining Space",
        "description": "Advancing pawns or repositioning pieces to control more territory.",
    },
    {
        "name": "trading",
        "display_name": "Trading / Exchanging",
        "description": "Choosing the right piece exchanges to improve the position.",
    },
    {
        "name": "prophylaxis",
        "display_name": "Prophylaxis",
        "description": "Anticipating and preventing the opponent's threats before they arise.",
    },
    {
        "name": "coordination",
        "display_name": "Piece Co-ordination",
        "description": "Harmonising pieces so they support each other effectively.",
    },
    {
        "name": "exploitingweakness",
        "display_name": "Exploiting a Weakness",
        "description": "Targeting a lasting structural or positional weakness in the opponent's camp.",
    },
    {
        "name": "kingsafety",
        "display_name": "King Safety",
        "description": "Improving your king's shelter or exposing the opponent's king.",
    },
    {
        "name": "restriction",
        "display_name": "Restricting Opponent's Pieces",
        "description": "Limiting the mobility or scope of the opponent's key pieces.",
    },
    {
        "name": "fixingstructure",
        "display_name": "Fixing the Pawn Structure",
        "description": "Locking pawns in place to create lasting weaknesses or strengths.",
    },
    {
        "name": "centrecontrol",
        "display_name": "Controlling the Centre",
        "description": "Contesting or dominating the central squares to dictate play.",
    },
    {
        "name": "other",
        "display_name": "Other",
        "description": "A positional idea that does not fit neatly into any other category.",
    },
]

# Ordered list matching the CSV column order — used to scan each row for active themes.
THEME_COLUMN_NAMES: list[str] = [t["name"] for t in THEMES]


def seed_themes(session: Session) -> None:
    table = cast(sa.Table, ScrapedPositionalTheme.__table__)
    stmt = (
        pg_insert(table)
        .values(THEMES)
        .on_conflict_do_update(
            index_elements=["name"],
            set_={
                "display_name": pg_insert(table).excluded.display_name,
                "description": pg_insert(table).excluded.description,
            },
        )
    )
    session.execute(stmt)
    session.commit()
    click.echo(f"Upserted {len(THEMES)} themes.")
