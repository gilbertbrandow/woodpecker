"""create puzzles tables

Revision ID: c1d2e3f4a5b6
Revises: a8b3c4d5e6f7
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision: str = "c1d2e3f4a5b6"
down_revision: str | None = "a8b3c4d5e6f7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "themes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_themes_name", "themes", ["name"])

    op.create_table(
        "openings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_openings_name", "openings", ["name"])

    op.create_table(
        "puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("puzzle_id", sa.Text(), nullable=False),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("moves", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("rating_deviation", sa.Integer(), nullable=False),
        sa.Column("popularity", sa.Integer(), nullable=False),
        sa.Column("nb_plays", sa.Integer(), nullable=False),
        sa.Column("game_url", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("puzzle_id"),
    )
    op.create_index("ix_puzzles_rating", "puzzles", ["rating"])
    op.create_index("ix_puzzles_popularity", "puzzles", ["popularity"])

    op.create_table(
        "puzzle_themes",
        sa.Column("puzzle_id", sa.Integer(), sa.ForeignKey("puzzles.id"), primary_key=True),
        sa.Column("theme_id", sa.Integer(), sa.ForeignKey("themes.id"), primary_key=True),
    )

    op.create_table(
        "puzzle_openings",
        sa.Column("puzzle_id", sa.Integer(), sa.ForeignKey("puzzles.id"), primary_key=True),
        sa.Column("opening_id", sa.Integer(), sa.ForeignKey("openings.id"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("puzzle_openings")
    op.drop_table("puzzle_themes")
    op.drop_index("ix_puzzles_popularity", table_name="puzzles")
    op.drop_index("ix_puzzles_rating", table_name="puzzles")
    op.drop_table("puzzles")
    op.drop_index("ix_openings_name", table_name="openings")
    op.drop_table("openings")
    op.drop_index("ix_themes_name", table_name="themes")
    op.drop_table("themes")
