"""add opening_id to scraped_positional_puzzles

Links each scraped positional puzzle to an opening when the puzzle occurs at or
before ply 40 (20 full moves) and Lichess identifies the game's opening. Nullable
because most puzzles in the middlegame have no opening association.

Revision ID: c2d3e4f5a6b7
Revises: b0c1d2e3f4a5
Create Date: 2026-05-19

"""

from alembic import op
import sqlalchemy as sa

revision: str = "c2d3e4f5a6b7"
down_revision: str | None = "b0c1d2e3f4a5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "scraped_positional_puzzles",
        sa.Column("opening_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "scraped_positional_puzzles_opening_id_fkey",
        "scraped_positional_puzzles",
        "openings",
        ["opening_id"],
        ["id"],
    )
    op.create_index(
        "ix_scraped_positional_puzzles_opening_id",
        "scraped_positional_puzzles",
        ["opening_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_scraped_positional_puzzles_opening_id", table_name="scraped_positional_puzzles")
    op.drop_constraint(
        "scraped_positional_puzzles_opening_id_fkey",
        "scraped_positional_puzzles",
        type_="foreignkey",
    )
    op.drop_column("scraped_positional_puzzles", "opening_id")
