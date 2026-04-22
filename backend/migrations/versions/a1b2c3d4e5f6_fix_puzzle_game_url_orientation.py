"""fix puzzle game_url orientation

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-04-22

"""
from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f3a4b5c6d7e8"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE puzzles
        SET game_url = CASE
            WHEN split_part(fen, ' ', 2) = 'w' THEN
                regexp_replace(
                    regexp_replace(game_url, '/black(?=#|$)', '', 'g'),
                    '(#.*)?$',
                    '/black\\1'
                )
            WHEN split_part(fen, ' ', 2) = 'b' THEN
                regexp_replace(game_url, '/black(?=#|$)', '', 'g')
            ELSE game_url
        END
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE puzzles
        SET game_url = CASE
            WHEN split_part(fen, ' ', 2) = 'b' THEN
                regexp_replace(
                    regexp_replace(game_url, '/black(?=#|$)', '', 'g'),
                    '(#.*)?$',
                    '/black\\1'
                )
            WHEN split_part(fen, ' ', 2) = 'w' THEN
                regexp_replace(game_url, '/black(?=#|$)', '', 'g')
            ELSE game_url
        END
        """
    )
