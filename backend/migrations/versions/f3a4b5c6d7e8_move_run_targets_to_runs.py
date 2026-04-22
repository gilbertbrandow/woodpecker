"""move run targets to runs

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa

revision: str = "f3a4b5c6d7e8"
down_revision: str | None = "e2f3a4b5c6d7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("target_accuracy", sa.Float(), nullable=True))
    op.add_column("runs", sa.Column("target_solve_seconds", sa.Integer(), nullable=True))

    op.execute(sa.text("""
        UPDATE runs r
        SET target_accuracy = prt.target_accuracy,
            target_solve_seconds = prt.target_solve_seconds
        FROM participation_run_targets prt
        WHERE r.participation_id = prt.participation_id
          AND r.run_index = prt.run_index
    """))

    op.drop_table("participation_run_targets")


def downgrade() -> None:
    op.create_table(
        "participation_run_targets",
        sa.Column("participation_id", sa.Integer(), sa.ForeignKey("schedule_participations.id"), nullable=False),
        sa.Column("run_index", sa.Integer(), nullable=False),
        sa.Column("target_accuracy", sa.Float(), nullable=True),
        sa.Column("target_solve_seconds", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("participation_id", "run_index"),
    )

    op.execute(sa.text("""
        INSERT INTO participation_run_targets (participation_id, run_index, target_accuracy, target_solve_seconds)
        SELECT participation_id, run_index, target_accuracy, target_solve_seconds
        FROM runs
        WHERE target_accuracy IS NOT NULL OR target_solve_seconds IS NOT NULL
    """))

    op.drop_column("runs", "target_solve_seconds")
    op.drop_column("runs", "target_accuracy")
