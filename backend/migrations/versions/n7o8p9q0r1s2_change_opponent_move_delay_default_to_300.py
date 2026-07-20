"""change opponent_move_delay_ms default to 300

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Branch Labels: None
Depends On: None

"""

from alembic import op

revision: str = "n7o8p9q0r1s2"
down_revision: str | None = "m6n7o8p9q0r1"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column("users", "opponent_move_delay_ms", server_default="300")


def downgrade() -> None:
    op.alter_column("users", "opponent_move_delay_ms", server_default="200")
