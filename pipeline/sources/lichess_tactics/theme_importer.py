import xml.etree.ElementTree as ET
from pathlib import Path
from typing import cast

import click
import sqlalchemy as sa
from app.models.lichess_tactic_theme import LichessTacticTheme
from app.models.theme_category import ThemeCategory
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

THEME_CATEGORIES: dict[str, ThemeCategory] = {
    # NOISE — eval-threshold labels and puzzle-length descriptors with no pattern value
    "advantage": ThemeCategory.NOISE,
    "crushing": ThemeCategory.NOISE,
    "equality": ThemeCategory.NOISE,
    "long": ThemeCategory.NOISE,
    "short": ThemeCategory.NOISE,
    "veryLong": ThemeCategory.NOISE,
    "mix": ThemeCategory.NOISE,
    "playerGames": ThemeCategory.NOISE,
    "oneMove": ThemeCategory.NOISE,
    "puzzleDownloadInformation": ThemeCategory.NOISE,
    # META — game-context labels unrelated to the tactic itself
    "master": ThemeCategory.META,
    "masterVsMaster": ThemeCategory.META,
    "superGM": ThemeCategory.META,
    "middlegame": ThemeCategory.META,
    "endgame": ThemeCategory.META,
    "opening": ThemeCategory.META,
    # MECHANICAL — forced/goal-defined outcomes with no transferable pattern
    "mate": ThemeCategory.MECHANICAL,
    "mateIn1": ThemeCategory.MECHANICAL,
    "mateIn2": ThemeCategory.MECHANICAL,
    "mateIn3": ThemeCategory.MECHANICAL,
    "mateIn4": ThemeCategory.MECHANICAL,
    "mateIn5": ThemeCategory.MECHANICAL,
    # Everything else defaults to PATTERN (see _parse_themes_xml)
}


def _parse_themes_xml(file: Path) -> list[dict[str, str | ThemeCategory]]:
    tree = ET.parse(file)
    root = tree.getroot()

    themes: dict[str, dict[str, str | ThemeCategory]] = {}
    for el in root.findall("string"):
        name = el.get("name", "")
        text = (el.text or "").strip()
        if name.endswith("Description"):
            key = name[: -len("Description")]
            if key in themes:
                themes[key]["description"] = text
        else:
            themes[name] = {
                "name": name,
                "display_name": text,
                "description": "",
                "category": THEME_CATEGORIES.get(name, ThemeCategory.PATTERN),
            }

    return [v for v in themes.values() if v["display_name"]]


def import_themes(session: Session, file: Path) -> None:
    rows = _parse_themes_xml(file)
    if not rows:
        click.echo("No themes found in XML.")
        return

    theme_table = cast(sa.Table, LichessTacticTheme.__table__)
    stmt = (
        pg_insert(theme_table)
        .values(rows)
        .on_conflict_do_update(
            index_elements=["name"],
            set_={
                "display_name": pg_insert(theme_table).excluded.display_name,
                "description": pg_insert(theme_table).excluded.description,
                "category": pg_insert(theme_table).excluded.category,
            },
        )
    )
    session.execute(stmt)
    session.commit()
    click.echo(f"Upserted {len(rows)} themes.")
