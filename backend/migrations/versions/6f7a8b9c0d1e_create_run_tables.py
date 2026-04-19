"""create run tables

Revision ID: 6f7a8b9c0d1e
Revises: 5e6f7a8b9c0d
Create Date: 2026-04-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "6f7a8b9c0d1e"
down_revision: str | None = "5e6f7a8b9c0d"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "participation_id",
            sa.Integer(),
            sa.ForeignKey("schedule_participations.id"),
            nullable=False,
        ),
        sa.Column("run_index", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aborted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_runs_participation_id", "runs", ["participation_id"])
    op.create_index("ix_runs_status", "runs", ["status"])
    op.execute(
        sa.text("""
            CREATE UNIQUE INDEX uq_run_participation_slot_active
            ON runs (participation_id, run_index)
            WHERE status IN ('active', 'completed')
        """)
    )

    op.create_table(
        "run_puzzles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("puzzle_id", sa.Integer(), sa.ForeignKey("puzzles.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="not_started"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "position", name="uq_run_puzzle_position"),
    )

    op.create_table(
        "puzzle_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "run_puzzle_id",
            sa.Integer(),
            sa.ForeignKey("run_puzzles.id"),
            nullable=False,
        ),
        sa.Column("try_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(15), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("time_spent_ms", sa.Integer(), nullable=True),
        sa.Column(
            "moves",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_puzzle_id", "try_number", name="uq_attempt_run_puzzle_try"),
    )
    op.create_index(
        "ix_puzzle_attempts_run_puzzle_id", "puzzle_attempts", ["run_puzzle_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_puzzle_attempts_run_puzzle_id", table_name="puzzle_attempts")
    op.drop_table("puzzle_attempts")
    op.drop_table("run_puzzles")
    op.drop_index("uq_run_participation_slot_active", table_name="runs")
    op.drop_index("ix_runs_status", table_name="runs")
    op.drop_index("ix_runs_participation_id", table_name="runs")
    op.drop_table("runs")
