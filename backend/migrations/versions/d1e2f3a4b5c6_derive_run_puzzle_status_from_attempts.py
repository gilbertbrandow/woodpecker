"""derive run puzzle status from attempts

Revision ID: d1e2f3a4b5c6
Revises: c9d8e7f6a5b4
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa

revision: str = "d1e2f3a4b5c6"
down_revision: str | None = "c9d8e7f6a5b4"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(sa.text("TRUNCATE runs CASCADE"))
    op.execute(
        sa.text(
            "UPDATE schedule_participations SET status = 'draft', completed_at = NULL, aborted_at = NULL"
        )
    )
    op.drop_column("run_puzzles", "status")


def downgrade() -> None:
    op.add_column(
        "run_puzzles",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="not_started",
        ),
    )
