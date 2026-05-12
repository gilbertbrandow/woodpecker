import csv
import re
import unicodedata
from pathlib import Path
from typing import Any, cast

import click
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.opening import Opening


def opening_name_to_key(display_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", display_name).encode("ascii", "ignore").decode("ascii")
    key = normalized.replace(": ", "_").replace(", ", "_").replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9_-]", "", key)


def parent_display_name(display_name: str) -> str | None:
    if "," in display_name:
        return display_name.rsplit(",", 1)[0].strip()
    if ":" in display_name:
        return display_name.split(":")[0].strip()
    return None


def import_openings(session: Session, files: list[Path]) -> None:
    rows: list[dict[str, str]] = []
    for file_path in files:
        with open(file_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                display = row["name"].strip()
                rows.append({
                    "name": opening_name_to_key(display),
                    "display_name": display,
                    "eco": row["eco"].strip(),
                    "pgn": row["pgn"].strip(),
                })

    if not rows:
        click.echo("No rows found.")
        return

    opening_table = cast(sa.Table, Opening.__table__)
    stmt = (
        pg_insert(opening_table)
        .values(rows)
        .on_conflict_do_update(
            index_elements=["name"],
            set_={
                "display_name": pg_insert(opening_table).excluded.display_name,
                "eco": pg_insert(opening_table).excluded.eco,
                "pgn": pg_insert(opening_table).excluded.pgn,
            },
        )
    )
    session.execute(stmt)
    session.commit()
    click.echo(f"Upserted {len(rows)} openings.")

    display_to_id: dict[str, int] = {
        row.display_name: row.id
        for row in session.execute(
            sa.select(Opening.display_name, Opening.id).where(Opening.display_name.isnot(None))
        ).all()
    }

    updates: list[dict[str, Any]] = []
    for row in rows:
        parent = parent_display_name(row["display_name"])
        if parent is not None:
            parent_id = display_to_id.get(parent)
            if parent_id is not None:
                updates.append({"_name": row["name"], "_parent_id": parent_id})

    if updates:
        session.execute(
            sa.update(Opening)
            .where(Opening.name == sa.bindparam("_name"))
            .values(parent_id=sa.bindparam("_parent_id")),
            updates,
        )
        session.commit()

    roots = sum(1 for r in rows if parent_display_name(r["display_name"]) is None)
    click.echo(f"Parent links assigned: {len(updates)} | Root openings: {roots}")
