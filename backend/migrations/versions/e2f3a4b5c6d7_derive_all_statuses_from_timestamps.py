"""derive all statuses from timestamps

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa

revision: str = "e2f3a4b5c6d7"
down_revision: str | None = "d1e2f3a4b5c6"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM subset_puzzles WHERE is_discarded = TRUE"))
    op.drop_column("subset_puzzles", "is_discarded")
    op.drop_column("subsets", "status")
    op.drop_column("schedules", "status")
    op.drop_column("schedule_participations", "status")
    op.drop_index("ix_runs_status", table_name="runs")
    op.drop_column("runs", "status")


def downgrade() -> None:
    op.add_column(
        "runs",
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
    )
    op.create_index("ix_runs_status", "runs", ["status"])
    op.execute(sa.text(
        "UPDATE runs SET status = CASE"
        "  WHEN aborted_at IS NOT NULL THEN 'aborted'"
        "  WHEN completed_at IS NOT NULL THEN 'completed'"
        "  ELSE 'active'"
        " END"
    ))

    op.add_column(
        "schedule_participations",
        sa.Column("status", sa.String(15), nullable=False, server_default="draft"),
    )
    op.execute(sa.text(
        "UPDATE schedule_participations SET status = CASE"
        "  WHEN aborted_at IS NOT NULL THEN 'aborted'"
        "  WHEN completed_at IS NOT NULL THEN 'completed'"
        "  WHEN EXISTS (SELECT 1 FROM runs r WHERE r.participation_id = schedule_participations.id) THEN 'in_progress'"
        "  ELSE 'draft'"
        " END"
    ))

    op.add_column(
        "schedules",
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
    )
    op.execute(sa.text(
        "UPDATE schedules SET status = CASE"
        "  WHEN locked_at IS NOT NULL THEN 'locked'"
        "  ELSE 'draft'"
        " END"
    ))

    op.add_column(
        "subsets",
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
    )
    op.execute(sa.text(
        "UPDATE subsets SET status = CASE"
        "  WHEN locked_at IS NOT NULL THEN 'locked'"
        "  WHEN EXISTS (SELECT 1 FROM subset_puzzles sp WHERE sp.subset_id = subsets.id) THEN 'filled'"
        "  ELSE 'draft'"
        " END"
    ))

    op.add_column(
        "subset_puzzles",
        sa.Column(
            "is_discarded",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
