"""generalize training item

Revision ID: b2c3d4e5f6a7
Revises: aa76be20e4c1
Create Date: 2026-05-12

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "aa76be20e4c1"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # 1. Create Postgres enum for source_type
    training_item_source = postgresql.ENUM(
        "LICHESS_TACTIC", "DECOY", "POSITIONAL",
        name="training_item_source",
    )
    training_item_source.create(op.get_bind(), checkfirst=True)

    # 2. Create training_items table
    op.create_table(
        "training_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "source_type",
            # create_type=False: enum was created above; don't try to create it again
            postgresql.ENUM("LICHESS_TACTIC", "DECOY", "POSITIONAL", name="training_item_source", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. Insert one training_items row for every existing puzzles row, preserving id
    op.execute(sa.text(
        "INSERT INTO training_items (id, source_type, created_at) "
        "SELECT id, 'LICHESS_TACTIC', NOW() FROM puzzles"
    ))

    # Advance the training_items sequence past the current max puzzles id
    op.execute(sa.text(
        "SELECT setval(pg_get_serial_sequence('training_items', 'id'), "
        "COALESCE((SELECT MAX(id) FROM training_items), 0) + 1, false)"
    ))

    # 4. Rename puzzles → lichess_tactics
    op.rename_table("puzzles", "lichess_tactics")
    op.drop_index("ix_puzzles_rating", table_name="lichess_tactics")
    op.drop_index("ix_puzzles_popularity", table_name="lichess_tactics")
    op.create_index("ix_lichess_tactics_rating", "lichess_tactics", ["rating"])
    op.create_index("ix_lichess_tactics_popularity", "lichess_tactics", ["popularity"])

    # 5. Add training_item_id column to lichess_tactics (nullable first)
    op.add_column("lichess_tactics", sa.Column("training_item_id", sa.Integer(), nullable=True))

    # 6. Set training_item_id = id for all existing rows
    op.execute(sa.text("UPDATE lichess_tactics SET training_item_id = id"))

    # 7. Make training_item_id NOT NULL, add unique constraint and FK
    op.alter_column("lichess_tactics", "training_item_id", nullable=False)
    op.create_unique_constraint(
        "uq_lichess_tactics_training_item_id", "lichess_tactics", ["training_item_id"]
    )
    op.create_foreign_key(
        "lichess_tactics_training_item_id_fkey",
        "lichess_tactics", "training_items",
        ["training_item_id"], ["id"],
    )

    # 8. Rename themes → lichess_tactic_themes
    op.rename_table("themes", "lichess_tactic_themes")
    op.drop_index("ix_themes_name", table_name="lichess_tactic_themes")
    op.create_index("ix_lichess_tactic_themes_name", "lichess_tactic_themes", ["name"])

    # 9. Rename puzzle_themes → lichess_tactic_theme_links
    op.rename_table("puzzle_themes", "lichess_tactic_theme_links")

    # 10. Rename lichess_tactic_theme_links.puzzle_id → lichess_tactic_id
    #     Drop old FK, rename column, recreate FK with new names
    op.drop_constraint(
        "puzzle_themes_puzzle_id_fkey", "lichess_tactic_theme_links", type_="foreignkey"
    )
    op.drop_constraint(
        "puzzle_themes_theme_id_fkey", "lichess_tactic_theme_links", type_="foreignkey"
    )
    op.alter_column(
        "lichess_tactic_theme_links", "puzzle_id", new_column_name="lichess_tactic_id"
    )
    op.alter_column(
        "lichess_tactic_theme_links", "theme_id", new_column_name="lichess_tactic_theme_id"
    )
    op.create_foreign_key(
        "lichess_tactic_theme_links_lichess_tactic_id_fkey",
        "lichess_tactic_theme_links", "lichess_tactics",
        ["lichess_tactic_id"], ["id"],
    )
    op.create_foreign_key(
        "lichess_tactic_theme_links_lichess_tactic_theme_id_fkey",
        "lichess_tactic_theme_links", "lichess_tactic_themes",
        ["lichess_tactic_theme_id"], ["id"],
    )

    # 11-12. Rename puzzle_openings → lichess_tactic_openings
    op.rename_table("puzzle_openings", "lichess_tactic_openings")

    # 13. Rename lichess_tactic_openings.puzzle_id → lichess_tactic_id
    op.drop_constraint(
        "puzzle_openings_puzzle_id_fkey", "lichess_tactic_openings", type_="foreignkey"
    )
    op.alter_column(
        "lichess_tactic_openings", "puzzle_id", new_column_name="lichess_tactic_id"
    )
    op.create_foreign_key(
        "lichess_tactic_openings_lichess_tactic_id_fkey",
        "lichess_tactic_openings", "lichess_tactics",
        ["lichess_tactic_id"], ["id"],
    )

    # 14-15. Rename subset_puzzles → subset_training_items
    op.rename_table("subset_puzzles", "subset_training_items")

    # 16. Rename subset_training_items.puzzle_id → training_item_id
    op.drop_constraint(
        "subset_puzzles_puzzle_id_fkey", "subset_training_items", type_="foreignkey"
    )
    op.alter_column(
        "subset_training_items", "puzzle_id", new_column_name="training_item_id"
    )
    # 17. FK now points to training_items.id (generic root)
    op.create_foreign_key(
        "subset_training_items_training_item_id_fkey",
        "subset_training_items", "training_items",
        ["training_item_id"], ["id"],
    )

    # 18-19. Rename run_puzzles → run_training_items
    op.rename_table("run_puzzles", "run_training_items")

    # 20. Rename run_training_items.puzzle_id → training_item_id
    op.drop_constraint(
        "run_puzzles_puzzle_id_fkey", "run_training_items", type_="foreignkey"
    )
    op.alter_column(
        "run_training_items", "puzzle_id", new_column_name="training_item_id"
    )
    # FK now points to training_items.id
    op.create_foreign_key(
        "run_training_items_training_item_id_fkey",
        "run_training_items", "training_items",
        ["training_item_id"], ["id"],
    )
    # Rename unique constraint
    op.drop_constraint("uq_run_puzzle_position", "run_training_items", type_="unique")
    op.create_unique_constraint(
        "uq_run_training_item_position", "run_training_items", ["run_id", "position"]
    )

    # 21-22. Rename puzzle_attempts → training_attempts
    op.rename_table("puzzle_attempts", "training_attempts")

    # 23. Rename training_attempts.run_puzzle_id → run_training_item_id
    op.drop_constraint(
        "puzzle_attempts_run_puzzle_id_fkey", "training_attempts", type_="foreignkey"
    )
    op.alter_column(
        "training_attempts", "run_puzzle_id", new_column_name="run_training_item_id"
    )
    op.create_foreign_key(
        "training_attempts_run_training_item_id_fkey",
        "training_attempts", "run_training_items",
        ["run_training_item_id"], ["id"],
    )
    # Rename unique constraint and index
    op.drop_constraint("uq_attempt_run_puzzle_try", "training_attempts", type_="unique")
    op.create_unique_constraint(
        "uq_attempt_run_training_item_try",
        "training_attempts",
        ["run_training_item_id", "try_number"],
    )
    op.drop_index("ix_puzzle_attempts_run_puzzle_id", table_name="training_attempts")
    op.create_index(
        "ix_training_attempts_run_training_item_id",
        "training_attempts",
        ["run_training_item_id"],
    )


def downgrade() -> None:
    pass
