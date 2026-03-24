"""prune bad reference data, re-seed themes and openings, make fields non-nullable

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-03-24

"""
import csv
import os
import re
import xml.etree.ElementTree as ET

from alembic import op
import sqlalchemy as sa

revision = "2b3c4d5e6f7a"
down_revision = "1a2b3c4d5e6f"
branch_labels = None
depends_on = None

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
THEMES_FILE = os.path.join(DATA_DIR, "themes", "themes.xml")
OPENINGS_DIR = os.path.join(DATA_DIR, "openings")
TSV_FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"]

THEMES_UPSERT = sa.text("""
    INSERT INTO themes (name, display_name, description)
    VALUES (:name, :display_name, :description)
    ON CONFLICT (name) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            description  = EXCLUDED.description
""")

OPENINGS_UPSERT = sa.text("""
    INSERT INTO openings (name, display_name, eco, pgn)
    VALUES (:name, :display_name, :eco, :pgn)
    ON CONFLICT (name) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            eco          = EXCLUDED.eco,
            pgn          = EXCLUDED.pgn
""")

UPDATE_PARENT = sa.text("""
    UPDATE openings SET parent_id = :parent_id WHERE name = :name
""")


def _load_themes() -> list[dict[str, str | None]]:
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
    return [
        {
            "name": key,
            "display_name": data.get("display_name"),
            "description": data.get("description"),
        }
        for key, data in entries.items()
    ]


def _opening_name_to_key(display_name: str) -> str:
    key = display_name.replace(": ", "_").replace(", ", "_").replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9_]", "", key)


def _parent_display_name(display_name: str) -> str | None:
    if "," in display_name:
        return display_name.rsplit(",", 1)[0].strip()
    if ":" in display_name:
        return display_name.split(":")[0].strip()
    return None


def _load_opening_rows() -> list[dict[str, str]]:
    rows = []
    for filename in TSV_FILES:
        path = os.path.join(OPENINGS_DIR, filename)
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                display = row["name"].strip()
                rows.append({
                    "name": _opening_name_to_key(display),
                    "display_name": display,
                    "eco": row["eco"].strip(),
                    "pgn": row["pgn"].strip(),
                })
    return rows


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        DELETE FROM puzzle_themes
        WHERE theme_id IN (
            SELECT id FROM themes
            WHERE display_name IS NULL OR description IS NULL
        )
    """))
    conn.execute(sa.text(
        "DELETE FROM themes WHERE display_name IS NULL OR description IS NULL"
    ))

    conn.execute(sa.text("""
        DELETE FROM puzzle_openings
        WHERE opening_id IN (
            SELECT id FROM openings
            WHERE display_name IS NULL OR eco IS NULL OR pgn IS NULL
        )
    """))
    conn.execute(sa.text(
        "DELETE FROM openings WHERE display_name IS NULL OR eco IS NULL OR pgn IS NULL"
    ))

    conn.execute(THEMES_UPSERT, _load_themes())

    conn.execute(sa.text("""
        DELETE FROM puzzle_themes
        WHERE theme_id IN (
            SELECT id FROM themes
            WHERE display_name IS NULL OR description IS NULL
        )
    """))
    conn.execute(sa.text(
        "DELETE FROM themes WHERE display_name IS NULL OR description IS NULL"
    ))

    opening_rows = _load_opening_rows()
    conn.execute(OPENINGS_UPSERT, opening_rows)

    display_to_id: dict[str, int] = {
        row.display_name: row.id
        for row in conn.execute(
            sa.text("SELECT id, display_name FROM openings WHERE display_name IS NOT NULL")
        )
    }
    updates = [
        {"name": row["name"], "parent_id": display_to_id[parent]}
        for row in opening_rows
        if (parent := _parent_display_name(row["display_name"])) is not None
        and parent in display_to_id
    ]
    if updates:
        conn.execute(UPDATE_PARENT, updates)

    op.alter_column("themes", "display_name", existing_type=sa.Text(), nullable=False)
    op.alter_column("themes", "description", existing_type=sa.Text(), nullable=False)
    op.alter_column("openings", "display_name", existing_type=sa.Text(), nullable=False)
    op.alter_column("openings", "eco", existing_type=sa.String(3), nullable=False)
    op.alter_column("openings", "pgn", existing_type=sa.Text(), nullable=False)


def downgrade() -> None:
    op.alter_column("openings", "pgn", existing_type=sa.Text(), nullable=True)
    op.alter_column("openings", "eco", existing_type=sa.String(3), nullable=True)
    op.alter_column("openings", "display_name", existing_type=sa.Text(), nullable=True)
    op.alter_column("themes", "description", existing_type=sa.Text(), nullable=True)
    op.alter_column("themes", "display_name", existing_type=sa.Text(), nullable=True)
