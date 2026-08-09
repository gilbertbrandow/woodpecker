"""Fix double-encoded accepted_moves JSONB in decoy_puzzles

All rows were imported with accepted_moves stored as a JSONB string
(e.g. '"[{\"uci\":\"h4h3\",...}]"') instead of a JSONB array. This
unwraps the string back into a proper array using PostgreSQL's #>> '{}'
operator, which extracts the string value then re-parses it as JSONB.

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-08-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "p9q0r1s2t3u4"
down_revision: str | None = "o8p9q0r1s2t3"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(sa.text("""
        UPDATE decoy_puzzles
        SET accepted_moves = (accepted_moves #>> '{}')::jsonb
        WHERE jsonb_typeof(accepted_moves) = 'string'
    """))


def downgrade() -> None:
    pass
