"""seed themes

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-03-23

"""
import os
import xml.etree.ElementTree as ET

from alembic import op
import sqlalchemy as sa

revision: str = "e3f4a5b6c7d8"
down_revision: str | None = "d2e3f4a5b6c7"
branch_labels: str | None = None
depends_on: str | None = None

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
THEMES_FILE = os.path.join(DATA_DIR, "themes", "themes.xml")

UPSERT = sa.text("""
    INSERT INTO themes (name, display_name, description)
    VALUES (:name, :display_name, :description)
    ON CONFLICT (name) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            description  = EXCLUDED.description
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


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(UPSERT, _load_themes())


def downgrade() -> None:
    op.execute("UPDATE themes SET display_name = NULL, description = NULL")
