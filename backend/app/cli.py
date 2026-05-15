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
