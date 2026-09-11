"""nest attempt moves into variations (list[list[str]])

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-09-07
"""
import sqlalchemy as sa
from alembic import op

revision = "s2t3u4v5w6x7"
down_revision = "r1s2t3u4v5w6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE training_attempts
            SET moves = jsonb_build_array(moves)
            WHERE jsonb_array_length(moves) > 0
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE training_attempts
            SET moves = moves->0
            WHERE jsonb_array_length(moves) > 0
              AND jsonb_typeof(moves->0) = 'array'
            """
        )
    )
