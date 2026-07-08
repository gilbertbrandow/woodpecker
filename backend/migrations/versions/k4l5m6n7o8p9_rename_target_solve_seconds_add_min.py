"""rename target_solve_seconds to target_max_solve_seconds and add target_min_solve_seconds

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa

revision: str = "k4l5m6n7o8p9"
down_revision: str | None = "j3k4l5m6n7o8"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column("runs", "target_solve_seconds", new_column_name="target_max_solve_seconds")
    op.add_column("runs", sa.Column("target_min_solve_seconds", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "target_min_solve_seconds")
    op.alter_column("runs", "target_max_solve_seconds", new_column_name="target_solve_seconds")
