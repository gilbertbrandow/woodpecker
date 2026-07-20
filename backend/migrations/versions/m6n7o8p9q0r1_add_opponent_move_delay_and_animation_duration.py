"""add opponent_move_delay_ms and animation_duration_ms to users

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa

revision: str = "m6n7o8p9q0r1"
down_revision: str | None = "l5m6n7o8p9q0"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("opponent_move_delay_ms", sa.Integer(), nullable=False, server_default="200"))
    op.add_column("users", sa.Column("animation_duration_ms", sa.Integer(), nullable=False, server_default="150"))


def downgrade() -> None:
    op.drop_column("users", "animation_duration_ms")
    op.drop_column("users", "opponent_move_delay_ms")
