"""add scraped_positional tables

Adds all tables for the SCRAPED_POSITIONAL source: difficulty and theme lookup
tables, the puzzle table, pivot table, and per-import-run metadata table.
Also extends the source_import_source and source_import_operation enums.

Revision ID: b0c1d2e3f4a5
Revises: a0b1c2d3e4f5
Create Date: 2026-05-19

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b0c1d2e3f4a5"
down_revision: str | None = "a0b1c2d3e4f5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # 1. Extend existing enums with SCRAPED_POSITIONAL values
    op.execute(sa.text("ALTER TYPE source_import_source ADD VALUE 'SCRAPED_POSITIONAL'"))
    op.execute(sa.text("ALTER TYPE source_import_operation ADD VALUE 'SCRAPED_POSITIONAL_IMPORT'"))

    # 2. Difficulty lookup (4 seeded rows — Easy/Moderate/Hard/Very Hard)
    op.create_table(
        "scraped_positional_difficulties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("min_rating", sa.Integer(), nullable=True),
        sa.Column("max_rating", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("value", name="uq_scraped_positional_difficulties_value"),
    )

    # 3. Theme lookup (13 seeded rows)
    op.create_table(
        "scraped_positional_themes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_scraped_positional_themes_name"),
    )

    # 4. One row per imported puzzle; fen/moves are the enriched (pre-opponent) values
    op.create_table(
        "scraped_positional_puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("training_item_id", sa.Integer(), nullable=False),
        sa.Column("internal_id", sa.Integer(), nullable=False),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("moves", sa.Text(), nullable=False),
        sa.Column("lichess_url", sa.Text(), nullable=False),
        sa.Column("difficulty_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["training_item_id"],
            ["training_items.id"],
            name="scraped_positional_puzzles_training_item_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["difficulty_id"],
            ["scraped_positional_difficulties.id"],
            name="scraped_positional_puzzles_difficulty_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("training_item_id", name="uq_scraped_positional_puzzles_training_item_id"),
        sa.UniqueConstraint("internal_id", name="uq_scraped_positional_puzzles_internal_id"),
    )
    op.create_index(
        "ix_scraped_positional_puzzles_difficulty_id", "scraped_positional_puzzles", ["difficulty_id"]
    )

    # 5. Pivot: scraped_positional_puzzle ↔ theme (many-to-many)
    op.create_table(
        "scraped_positional_theme_links",
        sa.Column("positional_puzzle_id", sa.Integer(), nullable=False),
        sa.Column("positional_theme_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["positional_puzzle_id"],
            ["scraped_positional_puzzles.id"],
            name="scraped_positional_theme_links_positional_puzzle_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["positional_theme_id"],
            ["scraped_positional_themes.id"],
            name="scraped_positional_theme_links_positional_theme_id_fkey",
        ),
        sa.PrimaryKeyConstraint("positional_puzzle_id", "positional_theme_id"),
    )

    # 6. Per-import-run metadata (one-to-one with source_import_runs)
    op.create_table(
        "scraped_positional_source_run_metadata",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_import_run_id", sa.Integer(), nullable=False),
        sa.Column("imported_count", sa.Integer(), nullable=False),
        sa.Column("skipped_existing_count", sa.Integer(), nullable=False),
        sa.Column("enrichment_failures_count", sa.Integer(), nullable=False),
        sa.Column("total_positional_after_run", sa.Integer(), nullable=False),
        sa.Column("difficulty_counts_json", postgresql.JSONB(), nullable=False),
        sa.Column("theme_counts_json", postgresql.JSONB(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_import_run_id"],
            ["source_import_runs.id"],
            name="scraped_positional_source_run_metadata_src_import_run_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_import_run_id",
            name="uq_scraped_positional_source_run_metadata_source_import_run_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("scraped_positional_source_run_metadata")
    op.drop_table("scraped_positional_theme_links")
    op.drop_index(
        "ix_scraped_positional_puzzles_difficulty_id", table_name="scraped_positional_puzzles"
    )
    op.drop_table("scraped_positional_puzzles")
    op.drop_table("scraped_positional_themes")
    op.drop_table("scraped_positional_difficulties")
    # Note: Postgres does not support removing enum values once added.
    # source_import_source retains 'SCRAPED_POSITIONAL'.
    # source_import_operation retains 'SCRAPED_POSITIONAL_IMPORT'.
