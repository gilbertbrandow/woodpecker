"""seed openings

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-03-23

"""
import csv
import os
import re

from alembic import op
import sqlalchemy as sa

revision = "f4a5b6c7d8e9"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
OPENINGS_DIR = os.path.join(DATA_DIR, "openings")
TSV_FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"]

UPSERT = sa.text("""
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


def _opening_name_to_key(display_name: str) -> str:
    key = display_name.replace(": ", "_").replace(", ", "_").replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9_]", "", key)


def _parent_display_name(display_name: str) -> str | None:
    if "," in display_name:
        return display_name.rsplit(",", 1)[0].strip()
    if ":" in display_name:
        return display_name.split(":")[0].strip()
    return None


def _load_rows() -> list[dict[str, str]]:
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
    rows = _load_rows()

    conn.execute(UPSERT, rows)

    display_to_id: dict[str, int] = {
        row.display_name: row.id
        for row in conn.execute(
            sa.text("SELECT id, display_name FROM openings WHERE display_name IS NOT NULL")
        )
    }

    updates: list[dict[str, str | int]] = []
    for row in rows:
        parent = _parent_display_name(row["display_name"])
        if parent is not None:
            parent_id = display_to_id.get(parent)
            if parent_id is not None:
                updates.append({"name": row["name"], "parent_id": parent_id})

    if updates:
        conn.execute(UPDATE_PARENT, updates)


def downgrade() -> None:
    op.execute("DELETE FROM openings")
