"""rename schedule_participations to trainings

Revision ID: abcd1234ef56
Revises: f3a4b5c6d7e8, f4a5b6c7d8e9
Create Date: 2026-04-28

"""

from alembic import op
import sqlalchemy as sa

revision: str = "abcd1234ef56"
down_revision: tuple[str, str] = ("f3a4b5c6d7e8", "f4a5b6c7d8e9")
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_index("ix_runs_participation_id", table_name="runs")
    op.drop_constraint("runs_participation_id_fkey", "runs", type_="foreignkey")
    op.alter_column("runs", "participation_id", new_column_name="training_id")

    op.drop_index("ix_schedule_participations_user_id", table_name="schedule_participations")
    op.drop_index("ix_schedule_participations_schedule_id", table_name="schedule_participations")
    op.drop_constraint("uq_participation_user_schedule", "schedule_participations")
    op.create_unique_constraint(
        "uq_training_user_schedule", "schedule_participations", ["user_id", "schedule_id"]
    )
    op.rename_table("schedule_participations", "trainings")

    op.create_index("ix_trainings_user_id", "trainings", ["user_id"])
    op.create_index("ix_trainings_schedule_id", "trainings", ["schedule_id"])
    op.create_foreign_key(
        "runs_training_id_fkey", "runs", "trainings", ["training_id"], ["id"]
    )
    op.create_index("ix_runs_training_id", "runs", ["training_id"])


def downgrade() -> None:
    op.drop_index("ix_runs_training_id", table_name="runs")
    op.drop_constraint("runs_training_id_fkey", "runs", type_="foreignkey")
    op.alter_column("runs", "training_id", new_column_name="participation_id")

    op.drop_index("ix_trainings_user_id", table_name="trainings")
    op.drop_index("ix_trainings_schedule_id", table_name="trainings")
    op.drop_constraint("uq_training_user_schedule", "trainings")
    op.create_unique_constraint(
        "uq_participation_user_schedule", "trainings", ["user_id", "schedule_id"]
    )
    op.rename_table("trainings", "schedule_participations")

    op.create_index(
        "ix_schedule_participations_user_id", "schedule_participations", ["user_id"]
    )
    op.create_index(
        "ix_schedule_participations_schedule_id", "schedule_participations", ["schedule_id"]
    )
    op.create_foreign_key(
        "runs_participation_id_fkey",
        "runs",
        "schedule_participations",
        ["participation_id"],
        ["id"],
    )
    op.create_index("ix_runs_participation_id", "runs", ["participation_id"])
