import xml.etree.ElementTree as ET
from pathlib import Path
from typing import cast

import click
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.lichess_tactic_theme import LichessTacticTheme


def _parse_themes_xml(file: Path) -> list[dict]:
    tree = ET.parse(file)
    root = tree.getroot()

    themes: dict[str, dict] = {}
    for el in root.findall("string"):
        name = el.get("name", "")
        text = (el.text or "").strip()
        if name.endswith("Description"):
            key = name[: -len("Description")]
            if key in themes:
                themes[key]["description"] = text
        else:
            themes[name] = {"name": name, "display_name": text, "description": ""}

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
            },
        )
    )
    session.execute(stmt)
    session.commit()
    click.echo(f"Upserted {len(rows)} themes.")
