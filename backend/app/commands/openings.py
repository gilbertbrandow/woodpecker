import csv
import re
import unicodedata
from typing import cast

import click
import sqlalchemy as sa
from flask.cli import AppGroup
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.extensions import db
from app.models.opening import Opening

openings_cli = AppGroup("openings")


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


@openings_cli.command("import")
@click.option("--file", "file_paths", required=True, multiple=True, type=click.Path(exists=True), help="Path to a TSV file (repeatable)")
def import_openings(file_paths: tuple[str, ...]) -> None:
    rows: list[dict[str, str]] = []

    for file_path in file_paths:
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
    db.session.execute(stmt)
    db.session.commit()
    click.echo(f"Upserted {len(rows)} openings.")

    display_to_id: dict[str, int] = {
        row.display_name: row.id
        for row in db.session.execute(
            db.select(Opening.display_name, Opening.id).where(Opening.display_name.isnot(None))
        ).all()
    }

    updates: list[dict] = []
    for row in rows:
        parent = parent_display_name(row["display_name"])
        if parent is not None:
            parent_id = display_to_id.get(parent)
            if parent_id is not None:
                updates.append({"_name": row["name"], "_parent_id": parent_id})

    if updates:
        db.session.execute(
            db.update(Opening)
            .where(Opening.name == db.bindparam("_name"))
            .values(parent_id=db.bindparam("_parent_id")),
            updates,
        )
        db.session.commit()

    roots = sum(1 for r in rows if parent_display_name(r["display_name"]) is None)
    click.echo(f"Parent links assigned: {len(updates)} | Root openings: {roots}")
