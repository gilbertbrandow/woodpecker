"""add board_theme and piece_theme to users

Revision ID: b5c6d7e8f9a0
Revises: a8b3c4d5e6f7
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa


revision: str = 'b5c6d7e8f9a0'
down_revision: str | None = 'a8b3c4d5e6f7'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('board_theme', sa.String(64), nullable=False, server_default='green'))
    op.add_column('users', sa.Column('piece_theme', sa.String(64), nullable=False, server_default='cburnett'))


def downgrade() -> None:
    op.drop_column('users', 'piece_theme')
    op.drop_column('users', 'board_theme')
