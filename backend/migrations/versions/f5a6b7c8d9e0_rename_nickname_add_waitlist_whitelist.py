"""rename nickname to display_name, add waitlist and whitelist tables

Revision ID: f5a6b7c8d9e0
Revises: e0f1a2b3c4d5
Create Date: 2026-05-15

"""
from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: str | None = "e0f1a2b3c4d5"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column('users', 'nickname', new_column_name='display_name', existing_type=sa.String(32), nullable=True)

    op.execute(sa.text("UPDATE users SET display_name = lichess_username WHERE display_name IS NULL"))

    op.alter_column('users', 'display_name', existing_type=sa.String(32), nullable=False)

    op.create_table(
        'waitlist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lichess_username', sa.String(), nullable=False),
        sa.Column('email', sa.String(254), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lichess_username'),
    )

    op.create_table(
        'whitelist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lichess_username', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lichess_username'),
    )


def downgrade() -> None:
    op.drop_table('whitelist')
    op.drop_table('waitlist')
    op.alter_column('users', 'display_name', new_column_name='nickname', existing_type=sa.String(32), nullable=True)
