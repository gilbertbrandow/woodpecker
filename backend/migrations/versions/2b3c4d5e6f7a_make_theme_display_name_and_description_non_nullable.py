"""make theme display_name and description non-nullable

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision = "2b3c4d5e6f7a"
down_revision = "1a2b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("themes", "display_name", existing_type=sa.Text(), nullable=False)
    op.alter_column("themes", "description", existing_type=sa.Text(), nullable=False)


def downgrade() -> None:
    op.alter_column("themes", "description", existing_type=sa.Text(), nullable=True)
    op.alter_column("themes", "display_name", existing_type=sa.Text(), nullable=True)
