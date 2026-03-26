"""add locked_puzzle_count to subsets

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
Create Date: 2026-03-26

"""

from alembic import op
import sqlalchemy as sa

revision: str = "4d5e6f7a8b9c"
down_revision: str | None = "3c4d5e6f7a8b"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("subsets", sa.Column("locked_puzzle_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("subsets", "locked_puzzle_count")
