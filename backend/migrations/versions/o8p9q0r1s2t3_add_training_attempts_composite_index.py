"""Add composite index on training_attempts(run_training_item_id, status, try_number)

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-07-23
"""

from __future__ import annotations

from alembic import op

revision: str = "o8p9q0r1s2t3"
down_revision: str | None = "n7o8p9q0r1s2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_training_attempts_rp_status_try",
        "training_attempts",
        ["run_training_item_id", "status", "try_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_training_attempts_rp_status_try", table_name="training_attempts")
