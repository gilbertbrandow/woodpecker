"""enrich openings and themes schema

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision: str = "d2e3f4a5b6c7"
down_revision: str | None = "c1d2e3f4a5b6"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("openings", sa.Column("display_name", sa.Text(), nullable=True))
    op.add_column("openings", sa.Column("eco", sa.String(3), nullable=True))
    op.add_column("openings", sa.Column("pgn", sa.Text(), nullable=True))
    op.add_column("openings", sa.Column("parent_id", sa.Integer(), sa.ForeignKey("openings.id"), nullable=True))

    op.add_column("themes", sa.Column("display_name", sa.Text(), nullable=True))
    op.add_column("themes", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("openings", "parent_id")
    op.drop_column("openings", "pgn")
    op.drop_column("openings", "eco")
    op.drop_column("openings", "display_name")

    op.drop_column("themes", "description")
    op.drop_column("themes", "display_name")
