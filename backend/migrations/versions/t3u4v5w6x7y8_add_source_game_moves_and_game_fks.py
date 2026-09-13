"""add source game moves column, game FKs to puzzle tables, and SOURCE_GAME_BACKFILL enum values

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op

revision = "t3u4v5w6x7y8"
down_revision = "s2t3u4v5w6x7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("moves", sa.Text(), nullable=True))

    op.add_column("lichess_tactics", sa.Column("game_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_lichess_tactics_game_id", "lichess_tactics", "games", ["game_id"], ["id"]
    )
    op.create_index("ix_lichess_tactics_game_id", "lichess_tactics", ["game_id"])

    op.add_column("scraped_positional_puzzles", sa.Column("game_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_scraped_positional_puzzles_game_id", "scraped_positional_puzzles", "games", ["game_id"], ["id"]
    )
    op.create_index("ix_scraped_positional_puzzles_game_id", "scraped_positional_puzzles", ["game_id"])

    op.execute(sa.text("ALTER TYPE source_import_source ADD VALUE IF NOT EXISTS 'SOURCE_GAME_BACKFILL'"))
    op.execute(sa.text("ALTER TYPE source_import_operation ADD VALUE IF NOT EXISTS 'SOURCE_GAME_BACKFILL'"))


def downgrade() -> None:
    op.drop_index("ix_scraped_positional_puzzles_game_id", table_name="scraped_positional_puzzles")
    op.drop_constraint(
        "fk_scraped_positional_puzzles_game_id", "scraped_positional_puzzles", type_="foreignkey"
    )
    op.drop_column("scraped_positional_puzzles", "game_id")

    op.drop_index("ix_lichess_tactics_game_id", table_name="lichess_tactics")
    op.drop_constraint("fk_lichess_tactics_game_id", "lichess_tactics", type_="foreignkey")
    op.drop_column("lichess_tactics", "game_id")

    op.drop_column("games", "moves")
    # PostgreSQL does not support removing enum values;
    # SOURCE_GAME_BACKFILL remains in source_import_source and source_import_operation.
