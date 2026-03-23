from app.extensions import db
from app.models.theme import Theme


def list_themes() -> list[Theme]:
    return list(
        db.session.execute(
            db.select(Theme).order_by(Theme.display_name)
        ).scalars()
    )
