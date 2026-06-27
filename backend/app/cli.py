import click
from flask import Flask


def register_commands(app: Flask) -> None:
    @app.cli.command("whitelist-add")
    @click.option("--username", required=True, help="Lichess username to whitelist")
    def whitelist_add(username: str) -> None:
        from app.services.whitelist_service import add

        added = add(username)
        if added:
            click.echo(f"Added {username.lower()} to whitelist.")
        else:
            click.echo(f"{username.lower()} is already whitelisted.")

    @app.cli.command("superadmin-add")
    @click.option("--username", required=True, help="Lichess username to grant superadmin")
    def superadmin_add(username: str) -> None:
        import sqlalchemy as sa
        from app.extensions import db
        from app.models.user import User

        normalized = username.lower()
        user = db.session.execute(
            sa.select(User).filter_by(lichess_username=normalized)
        ).scalar_one_or_none()
        if not user:
            click.echo(f"No active user found with Lichess username '{normalized}'.")
            return
        # TODO: restore after migration i2j3k4l5m6n7 is applied to prod
        click.echo("superadmin-add is disabled until the migration is applied.")
