"""add source_run_metadata and alter training_items

Revision ID: d0e1f2a3b4c5
Revises: c0d1e2f3a4b5
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d0e1f2a3b4c5"
down_revision: str | None = "c0d1e2f3a4b5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "lichess_tactics_source_run_metadata",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_import_run_id", sa.Integer(), nullable=False),
        sa.Column("total_rows_seen", sa.Integer(), nullable=False),
        sa.Column("imported_count", sa.Integer(), nullable=False),
        sa.Column("skipped_existing_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("total_tactics_after_run", sa.Integer(), nullable=False),
        sa.Column("tactics_with_themes_count", sa.Integer(), nullable=False),
        sa.Column("tactics_with_openings_count", sa.Integer(), nullable=False),
        sa.Column("min_rating", sa.Integer(), nullable=False),
        sa.Column("max_rating", sa.Integer(), nullable=False),
        sa.Column("rating_bucket_counts_json", postgresql.JSONB(), nullable=False),
        sa.Column("theme_counts_json", postgresql.JSONB(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_import_run_id"],
            ["source_import_runs.id"],
            name="lichess_tactics_source_run_metadata_source_import_run_id_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_import_run_id",
            name="uq_lichess_meta_source_import_run_id",
        ),
    )

    op.add_column(
        "training_items",
        sa.Column("source_import_run_id", sa.Integer(), nullable=True),
    )

    # Backfill existing data: insert a synthetic SourceImportRun for all existing
    # LICHESS_TACTIC training items, then compute and store initial metadata.
    # Skipped entirely on fresh databases with no LICHESS_TACTIC rows.
    op.execute(sa.text("""
        DO $$
        DECLARE
            synthetic_run_id     INT;
            tactic_count         INT;
            with_themes_count    INT;
            with_openings_count  INT;
            min_r                INT;
            max_r                INT;
            bucket_json          JSONB;
            theme_json           JSONB;
        BEGIN
            SELECT COUNT(*) INTO tactic_count
            FROM training_items
            WHERE source_type = 'LICHESS_TACTIC';

            IF tactic_count = 0 THEN
                RETURN;
            END IF;

            INSERT INTO source_import_runs
                (source, operation, status, started_at, finished_at, parameters_json)
            VALUES
                (
                    'LICHESS_TACTICS',
                    'LICHESS_TACTICS_IMPORT',
                    'SUCCEEDED',
                    NOW(),
                    NOW(),
                    '{"synthetic": true, "reason": "migration_backfill"}'::jsonb
                )
            RETURNING id INTO synthetic_run_id;

            UPDATE training_items
            SET source_import_run_id = synthetic_run_id
            WHERE source_type = 'LICHESS_TACTIC';

            SELECT COUNT(DISTINCT ltt.lichess_tactic_id) INTO with_themes_count
            FROM lichess_tactic_theme_links ltt;

            SELECT COUNT(DISTINCT lto.lichess_tactic_id) INTO with_openings_count
            FROM lichess_tactic_openings lto;

            SELECT MIN(lt.rating), MAX(lt.rating) INTO min_r, max_r
            FROM lichess_tactics lt;

            SELECT json_object_agg(bucket, cnt)::jsonb INTO bucket_json
            FROM (
                SELECT
                    (FLOOR(lt.rating / 50) * 50)::int AS bucket,
                    COUNT(*)::int AS cnt
                FROM lichess_tactics lt
                GROUP BY bucket
                ORDER BY bucket
            ) sub;

            SELECT json_object_agg(t.name, theme_cnt)::jsonb INTO theme_json
            FROM (
                SELECT th.name, COUNT(*) AS theme_cnt
                FROM lichess_tactic_theme_links ltt_link
                JOIN lichess_tactic_themes th ON th.id = ltt_link.lichess_tactic_theme_id
                GROUP BY th.name
            ) t;

            INSERT INTO lichess_tactics_source_run_metadata (
                source_import_run_id,
                total_rows_seen,
                imported_count,
                skipped_existing_count,
                failed_count,
                total_tactics_after_run,
                tactics_with_themes_count,
                tactics_with_openings_count,
                min_rating,
                max_rating,
                rating_bucket_counts_json,
                theme_counts_json,
                generated_at
            ) VALUES (
                synthetic_run_id,
                tactic_count,
                tactic_count,
                0,
                0,
                tactic_count,
                with_themes_count,
                with_openings_count,
                COALESCE(min_r, 0),
                COALESCE(max_r, 0),
                COALESCE(bucket_json, '{}'::jsonb),
                COALESCE(theme_json, '{}'::jsonb),
                NOW()
            );
        END;
        $$;
    """))

    op.create_foreign_key(
        "training_items_source_import_run_id_fkey",
        "training_items",
        "source_import_runs",
        ["source_import_run_id"],
        ["id"],
    )

    op.drop_column("training_items", "created_at")


def downgrade() -> None:
    op.add_column(
        "training_items",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.drop_constraint(
        "training_items_source_import_run_id_fkey", "training_items", type_="foreignkey"
    )
    op.drop_column("training_items", "source_import_run_id")
    op.drop_table("lichess_tactics_source_run_metadata")
