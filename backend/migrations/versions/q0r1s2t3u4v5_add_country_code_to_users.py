"""add country_code to users

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-08-31

"""
import sqlalchemy as sa
from alembic import op

revision: str = "q0r1s2t3u4v5"
down_revision: str | None = "p9q0r1s2t3u4"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("country_code", sa.String(2), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "country_code")
