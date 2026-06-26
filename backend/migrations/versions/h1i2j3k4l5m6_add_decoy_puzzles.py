"""Add games table and decoy_puzzles table

Revision ID: h1i2j3k4l5m6
Revises: g6b7c8d9e0f1, a4b5c6d7e8f9, f3a4b5c6d7e8
Create Date: 2026-06-21

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "h1i2j3k4l5m6"
down_revision: tuple[str, ...] = ("g6b7c8d9e0f1", "a4b5c6d7e8f9", "f3a4b5c6d7e8")
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # 1. Extend enums
    op.execute(sa.text("ALTER TYPE source_import_source ADD VALUE IF NOT EXISTS 'DECOY'"))
    op.execute(sa.text("ALTER TYPE source_import_operation ADD VALUE IF NOT EXISTS 'DECOY_IMPORT'"))

    # 2. Create games table (generic — not decoy-specific)
    op.create_table(
        "games",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lichess_id", sa.Text(), nullable=True),
        sa.Column("white", sa.Text(), nullable=False),
        sa.Column("black", sa.Text(), nullable=False),
        sa.Column("white_elo", sa.Integer(), nullable=True),
        sa.Column("black_elo", sa.Integer(), nullable=True),
        sa.Column("white_title", sa.Text(), nullable=True),
        sa.Column("black_title", sa.Text(), nullable=True),
        sa.Column("event", sa.Text(), nullable=True),
        sa.Column("date", sa.Text(), nullable=True),
        sa.Column("eco", sa.Text(), nullable=True),
        sa.Column("opening_id", sa.Integer(), nullable=True),
        sa.Column("source_import_run_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["opening_id"], ["openings.id"], name="games_opening_id_fkey"),
        sa.ForeignKeyConstraint(
            ["source_import_run_id"],
            ["source_import_runs.id"],
            name="games_source_import_run_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lichess_id", name="uq_games_lichess_id"),
    )
    op.create_index("ix_games_lichess_id", "games", ["lichess_id"])
    op.create_index("ix_games_opening_id", "games", ["opening_id"])
    op.create_index("ix_games_source_import_run_id", "games", ["source_import_run_id"])

    # 3. Create decoy_puzzles table
    op.create_table(
        "decoy_puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("training_item_id", sa.Integer(), nullable=False),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("opponent_move", sa.Text(), nullable=False),
        sa.Column("accepted_moves", postgresql.JSONB(), nullable=False),
        sa.Column("best_cp", sa.Integer(), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("move_number", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("analysis_url", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["training_item_id"],
            ["training_items.id"],
            name="decoy_puzzles_training_item_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["game_id"],
            ["games.id"],
            name="decoy_puzzles_game_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("training_item_id", name="uq_decoy_puzzles_training_item_id"),
    )
    op.create_index("ix_decoy_puzzles_game_id", "decoy_puzzles", ["game_id"])
    op.create_index("ix_decoy_puzzles_fen", "decoy_puzzles", ["fen"])

    # 4. Create decoy_source_run_metadata table
    op.create_table(
        "decoy_source_run_metadata",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_import_run_id", sa.Integer(), nullable=False),
        sa.Column("imported_count", sa.Integer(), nullable=False),
        sa.Column("skipped_existing_count", sa.Integer(), nullable=False),
        sa.Column("total_decoys_after_run", sa.Integer(), nullable=False),
        sa.Column("opening_counts_json", postgresql.JSONB(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_import_run_id"],
            ["source_import_runs.id"],
            name="decoy_source_run_metadata_source_import_run_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_import_run_id",
            name="uq_decoy_source_run_metadata_source_import_run_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("decoy_source_run_metadata")
    op.drop_index("ix_decoy_puzzles_fen", table_name="decoy_puzzles")
    op.drop_index("ix_decoy_puzzles_game_id", table_name="decoy_puzzles")
    op.drop_table("decoy_puzzles")
    op.drop_index("ix_games_source_import_run_id", table_name="games")
    op.drop_index("ix_games_opening_id", table_name="games")
    op.drop_index("ix_games_lichess_id", table_name="games")
    op.drop_table("games")
    # Note: PostgreSQL does not support removing enum values; skip enum downgrade
