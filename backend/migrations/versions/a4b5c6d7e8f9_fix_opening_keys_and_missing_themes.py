"""fix opening keys and missing themes

Revision ID: a4b5c6d7e8f9
Revises: f4a5b6c7d8e9
Create Date: 2026-05-06

"""
import csv
import os
import re
import unicodedata
import xml.etree.ElementTree as ET

from alembic import op
import sqlalchemy as sa

revision: str = "a4b5c6d7e8f9"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | None = None
depends_on: str | None = None

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
OPENINGS_DIR = os.path.join(DATA_DIR, "openings")
TSV_FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"]
THEMES_FILE = os.path.join(DATA_DIR, "themes", "themes.xml")


def _old_key(display_name: str) -> str:
    key = display_name.replace(": ", "_").replace(", ", "_").replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9_]", "", key)


def _new_key(display_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", display_name).encode("ascii", "ignore").decode("ascii")
    key = normalized.replace(": ", "_").replace(", ", "_").replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9_-]", "", key)


def _parent_display_name(display_name: str) -> str | None:
    if "," in display_name:
        return display_name.rsplit(",", 1)[0].strip()
    if ":" in display_name:
        return display_name.split(":")[0].strip()
    return None


def upgrade() -> None:
    conn = op.get_bind()

    rows: list[dict[str, str]] = []
    for filename in TSV_FILES:
        path = os.path.join(OPENINGS_DIR, filename)
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                display = row["name"].strip()
                rows.append({
                    "name": _new_key(display),
                    "display_name": display,
                    "eco": row["eco"].strip(),
                    "pgn": row["pgn"].strip(),
                    "_old_name": _old_key(display),
                })

    for row in rows:
        if row["_old_name"] != row["name"]:
            conn.execute(
                sa.text("UPDATE openings SET name = :new WHERE name = :old"),
                {"new": row["name"], "old": row["_old_name"]},
            )

    upsert_rows = [{k: v for k, v in r.items() if k != "_old_name"} for r in rows]
    conn.execute(
        sa.text("""
            INSERT INTO openings (name, display_name, eco, pgn)
            VALUES (:name, :display_name, :eco, :pgn)
            ON CONFLICT (name) DO UPDATE
                SET display_name = EXCLUDED.display_name,
                    eco          = EXCLUDED.eco,
                    pgn          = EXCLUDED.pgn
        """),
        upsert_rows,
    )

    display_to_id: dict[str, int] = {
        r.display_name: r.id
        for r in conn.execute(sa.text("SELECT id, display_name FROM openings WHERE display_name IS NOT NULL"))
    }
    updates = []
    for row in rows:
        parent = _parent_display_name(row["display_name"])
        if parent and (parent_id := display_to_id.get(parent)):
            updates.append({"name": row["name"], "parent_id": parent_id})
    if updates:
        conn.execute(sa.text("UPDATE openings SET parent_id = :parent_id WHERE name = :name"), updates)

    tree = ET.parse(THEMES_FILE)
    entries: dict[str, dict[str, str]] = {}
    for elem in tree.getroot().findall("string"):
        attr = elem.get("name", "")
        text = (elem.text or "").strip()
        if attr.endswith("Description"):
            key = attr[:-11]
            entries.setdefault(key, {})["description"] = text
        else:
            entries.setdefault(attr, {})["display_name"] = text

    theme_rows = [
        {"name": key, "display_name": data.get("display_name"), "description": data.get("description")}
        for key, data in entries.items()
        if data.get("display_name") and data.get("description")
    ]
    conn.execute(
        sa.text("""
            INSERT INTO themes (name, display_name, description)
            VALUES (:name, :display_name, :description)
            ON CONFLICT (name) DO UPDATE
                SET display_name = EXCLUDED.display_name,
                    description  = EXCLUDED.description
        """),
        theme_rows,
    )


def downgrade() -> None:
    pass
