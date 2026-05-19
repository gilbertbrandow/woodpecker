"""rename POSITIONAL to SCRAPED_POSITIONAL in training_item_source enum

Revision ID: a0b1c2d3e4f5
Revises: f5a6b7c8d9e0
Create Date: 2026-05-19

"""

from alembic import op

revision: str = "a0b1c2d3e4f5"
down_revision: str | None = "f5a6b7c8d9e0"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE training_item_source RENAME VALUE 'POSITIONAL' TO 'SCRAPED_POSITIONAL'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TYPE training_item_source RENAME VALUE 'SCRAPED_POSITIONAL' TO 'POSITIONAL'"
    )
