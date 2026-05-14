"""alter lichess_tactics_source_run_metadata

Removes import-process diagnostics (total_rows_seen, skipped_existing_count, failed_count)
that belong in source_import_runs.summary_json, and adds opening_counts_json and average_rating
for richer source dashboard support.

Revision ID: e0f1a2b3c4d5
Revises: d0e1f2a3b4c5
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e0f1a2b3c4d5"
down_revision: str | None = "d0e1f2a3b4c5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_column("lichess_tactics_source_run_metadata", "total_rows_seen")
    op.drop_column("lichess_tactics_source_run_metadata", "skipped_existing_count")
    op.drop_column("lichess_tactics_source_run_metadata", "failed_count")

    op.add_column(
        "lichess_tactics_source_run_metadata",
        sa.Column("opening_counts_json", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "lichess_tactics_source_run_metadata",
        sa.Column("average_rating", sa.Integer(), nullable=True),
    )

    # Backfill opening_counts_json and average_rating for any existing metadata rows.
    op.execute(sa.text("""
        DO $$
        DECLARE
            meta_count INT;
        BEGIN
            SELECT COUNT(*) INTO meta_count
            FROM lichess_tactics_source_run_metadata;

            IF meta_count = 0 THEN
                RETURN;
            END IF;

            UPDATE lichess_tactics_source_run_metadata
            SET
                opening_counts_json = COALESCE(
                    (
                        SELECT json_object_agg(o.name, cnt)::jsonb
                        FROM (
                            SELECT o2.name, COUNT(*) AS cnt
                            FROM lichess_tactic_openings lto
                            JOIN openings o2 ON o2.id = lto.opening_id
                            GROUP BY o2.name
                        ) o
                    ),
                    '{}'::jsonb
                ),
                average_rating = (
                    SELECT AVG(rating)::int FROM lichess_tactics
                );
        END;
        $$;
    """))

    op.alter_column(
        "lichess_tactics_source_run_metadata",
        "opening_counts_json",
        nullable=False,
        existing_type=postgresql.JSONB(),
    )


def downgrade() -> None:
    op.drop_column("lichess_tactics_source_run_metadata", "average_rating")
    op.drop_column("lichess_tactics_source_run_metadata", "opening_counts_json")

    op.add_column(
        "lichess_tactics_source_run_metadata",
        sa.Column("total_rows_seen", sa.Integer(), nullable=True),
    )
    op.add_column(
        "lichess_tactics_source_run_metadata",
        sa.Column("skipped_existing_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "lichess_tactics_source_run_metadata",
        sa.Column("failed_count", sa.Integer(), nullable=True),
    )

    # Backfill removed columns with 0 so they can be made non-null again.
    op.execute(sa.text("""
        UPDATE lichess_tactics_source_run_metadata
        SET total_rows_seen = imported_count,
            skipped_existing_count = 0,
            failed_count = 0;
    """))

    op.alter_column(
        "lichess_tactics_source_run_metadata",
        "total_rows_seen",
        nullable=False,
        existing_type=sa.Integer(),
    )
    op.alter_column(
        "lichess_tactics_source_run_metadata",
        "skipped_existing_count",
        nullable=False,
        existing_type=sa.Integer(),
    )
    op.alter_column(
        "lichess_tactics_source_run_metadata",
        "failed_count",
        nullable=False,
        existing_type=sa.Integer(),
    )
