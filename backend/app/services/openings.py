from app.extensions import db
from app.models.opening import Opening

SEARCH_LIMIT = 20


def search_openings(query: str) -> list[Opening]:
    pattern = f"%{query}%"
    return list(
        db.session.execute(
            db.select(Opening)
            .where(Opening.display_name.ilike(pattern))
            .order_by(Opening.display_name)
            .limit(SEARCH_LIMIT)
        ).scalars()
    )
