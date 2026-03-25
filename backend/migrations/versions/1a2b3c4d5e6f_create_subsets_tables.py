"""create subsets tables

Revision ID: 1a2b3c4d5e6f
Revises: f4a5b6c7d8e9
Create Date: 2026-03-23

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "1a2b3c4d5e6f"
down_revision: str | None = "f4a5b6c7d8e9"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "subsets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
        sa.Column("puzzle_count", sa.Integer(), nullable=True),
        sa.Column("config", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subsets_user_id", "subsets", ["user_id"])

    op.create_table(
        "subset_puzzles",
        sa.Column("subset_id", sa.Integer(), sa.ForeignKey("subsets.id"), nullable=False),
        sa.Column("puzzle_id", sa.Integer(), sa.ForeignKey("puzzles.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_discarded", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("subset_id", "puzzle_id"),
    )
    op.create_index(
        "ix_subset_puzzles_subset_active",
        "subset_puzzles",
        ["subset_id", "is_discarded", "position"],
    )


def downgrade() -> None:
    op.drop_table("subset_puzzles")
    op.drop_table("subsets")
