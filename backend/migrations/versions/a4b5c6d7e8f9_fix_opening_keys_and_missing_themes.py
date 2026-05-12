"""fix opening keys and missing themes

Revision ID: a4b5c6d7e8f9
Revises: b1c2d3e4f5a6
Create Date: 2026-05-06

"""
revision: str = "a4b5c6d7e8f9"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Data repair removed — the pipeline importer uses the correct key normalisation
    # from the start, so this fix is not needed on a fresh import.
    # Re-run `make -C pipeline shared-openings-import` and
    # `make -C pipeline lichess-tactics-themes-import` to get clean data.
    pass


def downgrade() -> None:
    pass
