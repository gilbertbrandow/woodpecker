"""drop unique constraint uq_training_user_schedule

Revision ID: g6b7c8d9e0f1
Revises: d3e4f5a6b7c8
Create Date: 2026-05-23

"""
from alembic import op

revision: str = "g6b7c8d9e0f1"
down_revision: str | None = "d3e4f5a6b7c8"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_constraint("uq_training_user_schedule", "trainings", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("uq_training_user_schedule", "trainings", ["user_id", "schedule_id"])
