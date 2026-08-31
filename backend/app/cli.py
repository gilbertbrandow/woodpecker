import time

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
        user.is_superadmin = True
        db.session.commit()
        click.echo(f"Granted superadmin to {normalized}.")

    @app.cli.command("backfill-country")
    def backfill_country() -> None:
        """Fetch country_code from Lichess public API for users missing it."""
        import requests as http
        import sqlalchemy as sa

        from app.extensions import db
        from app.models.user import User

        users = db.session.scalars(
            sa.select(User).where(User.country_code.is_(None))
        ).all()

        if not users:
            click.echo("All users already have a country_code.")
            return

        click.echo(f"Backfilling country for {len(users)} users...")
        updated = 0
        for user in users:
            try:
                resp = http.get(
                    f"https://lichess.org/api/user/{user.lichess_username}",
                    timeout=5,
                )
                if resp.ok:
                    data = resp.json()
                    profile = data.get("profile") or {}
                    raw = profile.get("country")
                    if raw:
                        user.country_code = str(raw)[:2].upper()
                        updated += 1
            except http.exceptions.RequestException:
                click.echo(f"  Warning: failed to fetch {user.lichess_username}")
            time.sleep(0.1)  # ~10 req/s, well under Lichess rate limit

        db.session.commit()
        click.echo(f"Done. Updated {updated}/{len(users)} users.")
