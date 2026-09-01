"""widen country_code column to 32 chars for Lichess regional codes

Revision ID: r1s2t3u4v5w6
Revises: q0r1s2t3u4v5
Create Date: 2026-08-31
"""
import sqlalchemy as sa
from alembic import op

revision = "r1s2t3u4v5w6"
down_revision = "q0r1s2t3u4v5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "country_code", type_=sa.String(32), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("users", "country_code", type_=sa.String(2), existing_nullable=True)
