"""add nickname and avatar_url to users

Revision ID: a8b3c4d5e6f7
Revises: 2f63b1488359
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'a8b3c4d5e6f7'
down_revision = '2f63b1488359'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('nickname', sa.String(32), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'nickname')
