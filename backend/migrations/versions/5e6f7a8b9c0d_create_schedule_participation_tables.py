"""create schedule participation tables

Revision ID: 5e6f7a8b9c0d
Revises: 4d5e6f7a8b9c
Create Date: 2026-03-27

"""

from alembic import op
import sqlalchemy as sa

revision: str = "5e6f7a8b9c0d"
down_revision: str | None = "4d5e6f7a8b9c"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "schedule_participations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("schedule_id", sa.Integer(), sa.ForeignKey("schedules.id"), nullable=False),
        sa.Column("status", sa.String(15), nullable=False, server_default="draft"),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aborted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "schedule_id", name="uq_participation_user_schedule"),
    )
    op.create_index("ix_schedule_participations_user_id", "schedule_participations", ["user_id"])
    op.create_index(
        "ix_schedule_participations_schedule_id", "schedule_participations", ["schedule_id"]
    )
    op.create_index(
        "ix_schedule_participations_status", "schedule_participations", ["status"]
    )

    op.create_table(
        "participation_run_targets",
        sa.Column(
            "participation_id",
            sa.Integer(),
            sa.ForeignKey("schedule_participations.id"),
            nullable=False,
        ),
        sa.Column("run_index", sa.Integer(), nullable=False),
        sa.Column("target_accuracy", sa.Float(), nullable=True),
        sa.Column("target_solve_seconds", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("participation_id", "run_index"),
    )


def downgrade() -> None:
    op.drop_table("participation_run_targets")
    op.drop_index("ix_schedule_participations_status", table_name="schedule_participations")
    op.drop_index(
        "ix_schedule_participations_schedule_id", table_name="schedule_participations"
    )
    op.drop_index("ix_schedule_participations_user_id", table_name="schedule_participations")
    op.drop_table("schedule_participations")
