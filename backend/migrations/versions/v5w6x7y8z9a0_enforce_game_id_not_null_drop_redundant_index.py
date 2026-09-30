"""enforce game_id NOT NULL on puzzle tables, drop redundant ix_games_lichess_id

Revision ID: v5w6x7y8z9a0
Revises: u4v5w6x7y8z9
Create Date: 2026-09-30
"""
from alembic import op

revision = "v5w6x7y8z9a0"
down_revision = "u4v5w6x7y8z9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The unique constraint (uq_games_lichess_id) already covers lookups on
    # lichess_id; the plain ix_games_lichess_id index is redundant.
    op.drop_index("ix_games_lichess_id", table_name="games")

    op.alter_column("lichess_tactics", "game_id", nullable=False)
    op.alter_column("decoy_puzzles", "game_id", nullable=False)
    op.alter_column("scraped_positional_puzzles", "game_id", nullable=False)


def downgrade() -> None:
    op.alter_column("scraped_positional_puzzles", "game_id", nullable=True)
    op.alter_column("decoy_puzzles", "game_id", nullable=True)
    op.alter_column("lichess_tactics", "game_id", nullable=True)

    op.create_index("ix_games_lichess_id", "games", ["lichess_id"])
