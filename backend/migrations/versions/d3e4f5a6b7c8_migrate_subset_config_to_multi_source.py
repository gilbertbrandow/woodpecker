"""migrate subset config to multi-source format

Wraps each existing flat LICHESS_TACTIC config into a sources array at 100%.
See ADR 0009 and issue #117.

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-19

"""

from alembic import op
import sqlalchemy as sa

revision: str = "d3e4f5a6b7c8"
down_revision: str | None = "c2d3e4f5a6b7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(sa.text("""
        UPDATE subsets
        SET config = jsonb_build_object(
            'sources', jsonb_build_array(
                jsonb_build_object(
                    'source', 'LICHESS_TACTIC',
                    'percentage', 100,
                    'config', config
                )
            )
        )
        WHERE config @> '{}'::jsonb
          AND NOT (config ? 'sources')
    """))


def downgrade() -> None:
    pass
