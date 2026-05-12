import click
from sqlalchemy import select, func, distinct
from sqlalchemy.orm import Session

from app.models.lichess_tactic import LichessTactic, lichess_tactic_theme_links, lichess_tactic_openings


def validate_links(session: Session) -> None:
    total = session.scalar(select(func.count()).select_from(LichessTactic))
    if not total:
        click.echo("No tactics in database.")
        return

    with_themes = session.scalar(
        select(func.count(distinct(lichess_tactic_theme_links.c.lichess_tactic_id)))
    )
    with_openings = session.scalar(
        select(func.count(distinct(lichess_tactic_openings.c.lichess_tactic_id)))
    )

    click.echo(f"Total tactics:          {total:,}")
    click.echo(f"Tactics with themes:    {with_themes:,} ({with_themes / total:.1%})")
    click.echo(f"Tactics with openings:  {with_openings:,} ({with_openings / total:.1%})")

    if with_themes == 0:
        click.echo("ERROR: No tactics have theme links — import may have failed.")
        raise SystemExit(1)

    click.echo("Validation passed.")
