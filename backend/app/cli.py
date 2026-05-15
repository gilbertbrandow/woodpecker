import click
from flask import Flask
from datetime import datetime, timezone


def register_commands(app: Flask) -> None:
    @app.cli.command("whitelist-add")
    @click.option("--username", required=True, help="Lichess username to whitelist")
    def whitelist_add(username: str) -> None:
        from app.extensions import db
        from app.models.user import WhitelistEntry

        normalized = username.lower()
        existing = db.session.execute(
            db.select(WhitelistEntry).filter_by(lichess_username=normalized)
        ).scalar_one_or_none()

        if existing:
            click.echo(f"{normalized} is already whitelisted.")
            return

        entry = WhitelistEntry(
            lichess_username=normalized,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(entry)
        db.session.commit()
        click.echo(f"Added {normalized} to whitelist.")
