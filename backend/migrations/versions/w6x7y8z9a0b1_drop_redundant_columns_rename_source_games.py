"""Drop redundant columns and rename games table to source_games

Revision ID: w6x7y8z9a0b1
Revises: v5w6x7y8z9a0
Create Date: 2026-10-02
"""
import sqlalchemy as sa
from alembic import op

revision = "w6x7y8z9a0b1"
down_revision = "v5w6x7y8z9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("games", "source_games")
    op.execute("ALTER INDEX ix_games_opening_id RENAME TO ix_source_games_opening_id")
    op.execute("ALTER INDEX ix_games_source_import_run_id RENAME TO ix_source_games_source_import_run_id")
    op.drop_column("lichess_tactics", "game_url")
    op.drop_column("scraped_positional_puzzles", "lichess_url")
    op.drop_column("decoy_puzzles", "analysis_url")
    op.drop_column("decoy_puzzles", "opponent_move")


def downgrade() -> None:
    op.add_column("decoy_puzzles", sa.Column("opponent_move", sa.Text(), nullable=True))
    op.add_column("decoy_puzzles", sa.Column("analysis_url", sa.Text(), nullable=True))
    op.add_column("scraped_positional_puzzles", sa.Column("lichess_url", sa.Text(), nullable=True))
    op.add_column("lichess_tactics", sa.Column("game_url", sa.Text(), nullable=True))
    op.execute("ALTER INDEX ix_source_games_opening_id RENAME TO ix_games_opening_id")
    op.execute(
        "ALTER INDEX ix_source_games_source_import_run_id RENAME TO ix_games_source_import_run_id"
    )
    op.rename_table("source_games", "games")
