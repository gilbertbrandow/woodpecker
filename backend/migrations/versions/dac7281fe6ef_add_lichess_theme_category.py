"""add lichess theme category

Revision ID: dac7281fe6ef
Revises: v5w6x7y8z9a0
Create Date: 2026-10-03 11:20:53.377143

"""
import sqlalchemy as sa
from alembic import op

revision = "dac7281fe6ef"
down_revision = "w6x7y8z9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    theme_category = sa.Enum(
        "PATTERN", "MECHANICAL", "META", "NOISE",
        name="lichess_tactic_theme_category",
    )
    theme_category.create(op.get_bind())

    op.add_column(
        "lichess_tactic_themes",
        sa.Column("category", theme_category, nullable=True),
    )

    op.execute("UPDATE lichess_tactic_themes SET category = 'PATTERN'")

    op.execute(
        """
        UPDATE lichess_tactic_themes SET category = 'NOISE'
        WHERE name IN (
            'advantage', 'crushing', 'equality', 'long', 'short',
            'veryLong', 'mix', 'playerGames', 'oneMove', 'puzzleDownloadInformation'
        )
        """
    )
    op.execute(
        """
        UPDATE lichess_tactic_themes SET category = 'META'
        WHERE name IN (
            'master', 'masterVsMaster', 'superGM', 'middlegame', 'endgame', 'opening'
        )
        """
    )
    op.execute(
        """
        UPDATE lichess_tactic_themes SET category = 'MECHANICAL'
        WHERE name IN ('mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5')
        """
    )

    op.alter_column("lichess_tactic_themes", "category", nullable=False)


def downgrade() -> None:
    op.drop_column("lichess_tactic_themes", "category")
    op.execute("DROP TYPE lichess_tactic_theme_category")
