"""add last_seen_at to users

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-06-27

"""
from alembic import op
import sqlalchemy as sa


revision: str = "j3k4l5m6n7o8"
down_revision: str | None = "i2j3k4l5m6n7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_seen_at")
