"""make games.moves NOT NULL — clean up orphan game rows first

Must run AFTER the decoy re-import with the new JSONL (which populates moves from
the master games DB). Any game rows that still have moves IS NULL at that point are
OTB broadcast games that the Lichess API cannot serve; they are deleted here.

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op

revision = "u4v5w6x7y8z9"
down_revision = "t3u4v5w6x7y8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Unlink puzzle rows that reference games with no moves, then delete those games.
    op.execute(sa.text(
        "UPDATE decoy_puzzles SET game_id = NULL"
        " WHERE game_id IN (SELECT id FROM games WHERE moves IS NULL)"
    ))
    op.execute(sa.text(
        "UPDATE lichess_tactics SET game_id = NULL"
        " WHERE game_id IN (SELECT id FROM games WHERE moves IS NULL)"
    ))
    op.execute(sa.text(
        "UPDATE scraped_positional_puzzles SET game_id = NULL"
        " WHERE game_id IN (SELECT id FROM games WHERE moves IS NULL)"
    ))
    op.execute(sa.text("DELETE FROM games WHERE moves IS NULL"))
    op.alter_column("games", "moves", nullable=False)


def downgrade() -> None:
    op.alter_column("games", "moves", nullable=True)
