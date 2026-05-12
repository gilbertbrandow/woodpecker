"""prune bad reference data and make fields non-nullable

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-03-24

"""
from alembic import op
import sqlalchemy as sa

revision: str = "2b3c4d5e6f7a"
down_revision: str | None = "1a2b3c4d5e6f"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Remove any rows that would violate the NOT NULL constraints added below.
    # On a fresh database these are no-ops; on an existing database they prune
    # any partial rows left by earlier incomplete imports.
    op.execute(sa.text(
        "DELETE FROM puzzle_themes WHERE theme_id IN "
        "(SELECT id FROM themes WHERE display_name IS NULL OR description IS NULL)"
    ))
    op.execute(sa.text(
        "DELETE FROM themes WHERE display_name IS NULL OR description IS NULL"
    ))
    op.execute(sa.text(
        "DELETE FROM puzzle_openings WHERE opening_id IN "
        "(SELECT id FROM openings WHERE display_name IS NULL OR eco IS NULL OR pgn IS NULL)"
    ))
    op.execute(sa.text(
        "DELETE FROM openings WHERE display_name IS NULL OR eco IS NULL OR pgn IS NULL"
    ))

    op.alter_column("themes", "display_name", existing_type=sa.Text(), nullable=False)
    op.alter_column("themes", "description", existing_type=sa.Text(), nullable=False)
    op.alter_column("openings", "display_name", existing_type=sa.Text(), nullable=False)
    op.alter_column("openings", "eco", existing_type=sa.String(3), nullable=False)
    op.alter_column("openings", "pgn", existing_type=sa.Text(), nullable=False)


def downgrade() -> None:
    op.alter_column("openings", "pgn", existing_type=sa.Text(), nullable=True)
    op.alter_column("openings", "eco", existing_type=sa.String(3), nullable=True)
    op.alter_column("openings", "display_name", existing_type=sa.Text(), nullable=True)
    op.alter_column("themes", "description", existing_type=sa.Text(), nullable=True)
    op.alter_column("themes", "display_name", existing_type=sa.Text(), nullable=True)
