from app.extensions import db
from app.models.lichess_tactic_theme import LichessTacticTheme


def list_themes() -> list[LichessTacticTheme]:
    return list(
        db.session.execute(
            db.select(LichessTacticTheme).order_by(LichessTacticTheme.display_name)
        ).scalars()
    )
