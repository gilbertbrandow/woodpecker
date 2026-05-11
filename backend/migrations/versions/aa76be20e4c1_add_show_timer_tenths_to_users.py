"""add show_timer_tenths to users

Revision ID: aa76be20e4c1
Revises: a4b5c6d7e8f9
Create Date: 2026-05-11 19:19:55.513647

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aa76be20e4c1'
down_revision = 'a4b5c6d7e8f9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('show_timer_tenths', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('show_timer_tenths')
