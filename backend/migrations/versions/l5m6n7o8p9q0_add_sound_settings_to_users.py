"""add sound_enabled and sound_theme to users

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa

revision: str = "l5m6n7o8p9q0"
down_revision: str | None = "k4l5m6n7o8p9"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sound_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("sound_theme", sa.String(32), nullable=False, server_default="standard"))


def downgrade() -> None:
    op.drop_column("users", "sound_theme")
    op.drop_column("users", "sound_enabled")
