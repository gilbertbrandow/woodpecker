import json
from datetime import datetime, timezone

import sqlalchemy as sa

from app.extensions import db
from app.models.lichess_tactic import LichessTactic
from app.models.schedule import Schedule
from app.models.subset import Subset, SubsetTrainingItem
from app.models.user import User

DEFAULT_RATING_MIN = 0
DEFAULT_RATING_MAX = 9999
RATING_BUCKET_SIZE = 50
PAGE_SIZE = 25
VALID_SORT_COLUMNS: dict[str, str] = {
    "rating": "p.rating",
    "popularity": "p.popularity",
    "nb_plays": "p.nb_plays",
}


def subset_status(subset: Subset) -> str:
    if subset.locked_at is not None:
        return "locked"
    count = db.session.scalar(
        sa.select(sa.func.count()).where(SubsetTrainingItem.subset_id == subset.id)
    ) or 0
    return "filled" if count > 0 else "draft"


def _parse_config(config: dict[str, object]) -> tuple[
    int, int, float | None, float | None, str, list[str], float
]:
    rating_cfg = config.get("rating") or {}
    if not isinstance(rating_cfg, dict):
        rating_cfg = {}
    rating_min = int(rating_cfg.get("min", DEFAULT_RATING_MIN))  # type: ignore[arg-type]
    rating_max = int(rating_cfg.get("max", DEFAULT_RATING_MAX))  # type: ignore[arg-type]
    mu_raw = rating_cfg.get("mean")
    sigma_raw = rating_cfg.get("sigma")
    mu: float | None = float(mu_raw) if mu_raw is not None else None  # type: ignore[arg-type]
    sigma: float | None = float(sigma_raw) if sigma_raw is not None else None  # type: ignore[arg-type]

    theme_weights_raw = config.get("themes") or {}
    theme_weights_json = (
        json.dumps({k: float(v) for k, v in theme_weights_raw.items()})  # type: ignore[union-attr]
        if isinstance(theme_weights_raw, dict)
        else "{}"
    )

    openings_cfg = config.get("openings") or {}
    opening_items: list[str] = []
    opening_strength = 0.0
    if isinstance(openings_cfg, dict):
        items_raw = openings_cfg.get("items", [])
        opening_items = list(items_raw) if isinstance(items_raw, list) else []  # type: ignore[arg-type]
        if opening_items:
            opening_strength = float(openings_cfg.get("strength", 0.0))  # type: ignore[arg-type]

    return rating_min, rating_max, mu, sigma, theme_weights_json, opening_items, opening_strength


def _sample_puzzles(
    subset_id: int,
    config: dict[str, object],
    count: int,
) -> list[int]:
    rating_min, rating_max, mu, sigma, theme_weights_json, opening_items, opening_strength = (
        _parse_config(config)
    )

    rows = db.session.execute(
        sa.text("""
            WITH RECURSIVE
            opening_descendants AS (
                SELECT id FROM openings WHERE name = ANY(:opening_keys)
                UNION ALL
                SELECT o.id FROM openings o
                JOIN opening_descendants d ON o.parent_id = d.id
            ),
            opening_matches AS (
                SELECT DISTINCT lichess_tactic_id
                FROM lichess_tactic_openings
                WHERE opening_id IN (SELECT id FROM opening_descendants)
            ),
            eligible AS (
                SELECT ti.id, p.rating
                FROM training_items ti
                JOIN lichess_tactics p ON p.training_item_id = ti.id
                WHERE p.rating BETWEEN :min_r AND :max_r
                  AND ti.id NOT IN (
                      SELECT training_item_id FROM subset_training_items
                      WHERE subset_id = :sid
                  )
            ),
            theme_scores AS (
                SELECT ltl.lichess_tactic_id,
                       SUM(COALESCE(CAST(:theme_weights AS jsonb)->>(t.name), '1')::float) AS score
                FROM lichess_tactic_theme_links ltl
                JOIN lichess_tactic_themes t ON t.id = ltl.lichess_tactic_theme_id
                JOIN lichess_tactics lt ON lt.id = ltl.lichess_tactic_id
                WHERE lt.training_item_id IN (SELECT id FROM eligible)
                GROUP BY ltl.lichess_tactic_id
            ),
            weighted AS (
                SELECT
                    e.id,
                    COALESCE(ts.score, 0.0)
                    * CASE
                        WHEN :mu IS NULL OR :sigma IS NULL THEN 1.0
                        ELSE exp(-0.5 * power((e.rating::float - CAST(:mu AS float)) / CAST(:sigma AS float), 2))
                      END
                    * CASE
                        WHEN :opening_strength = 0 THEN 1.0
                        WHEN e.id IN (SELECT lt.training_item_id FROM lichess_tactic_openings lto JOIN lichess_tactics lt ON lt.id = lto.lichess_tactic_id WHERE lto.lichess_tactic_id IN (SELECT lichess_tactic_id FROM opening_matches)) THEN 1.0
                        ELSE 1.0 - :opening_strength
                      END AS weight
                FROM eligible e
                LEFT JOIN lichess_tactics lt2 ON lt2.training_item_id = e.id
                LEFT JOIN theme_scores ts ON ts.lichess_tactic_id = lt2.id
            )
            SELECT id
            FROM weighted
            WHERE weight > 0
            ORDER BY ln(random()) / weight DESC
            LIMIT :count
        """),
        {
            "sid": subset_id,
            "min_r": rating_min,
            "max_r": rating_max,
            "mu": mu,
            "sigma": sigma,
            "theme_weights": theme_weights_json,
            "opening_keys": opening_items,
            "opening_strength": opening_strength,
            "count": count,
        },
    ).all()

    return [row.id for row in rows]


def _sample_and_insert(
    subset_id: int,
    config: dict[str, object],
    count: int,
) -> int:
    sampled_ids = _sample_puzzles(subset_id, config, count)

    if not sampled_ids:
        return 0

    existing_max: int | None = db.session.execute(
        db.select(db.func.max(SubsetTrainingItem.position)).where(
            SubsetTrainingItem.subset_id == subset_id,
        )
    ).scalar()
    start_pos = (existing_max + 1) if existing_max is not None else 0

    db.session.execute(
        sa.insert(SubsetTrainingItem).values(
            [
                {
                    "subset_id": subset_id,
                    "training_item_id": tid,
                    "position": start_pos + i,
                }
                for i, tid in enumerate(sampled_ids)
            ]
        )
    )
    return len(sampled_ids)


def create_subset(user_id: int, name: str, puzzle_count: int) -> Subset:
    name = name.strip()
    if not name:
        raise ValueError("Name is required.")
    if not (5 <= puzzle_count <= 1000):
        raise ValueError("puzzle_count must be between 5 and 1000.")
    subset = Subset(user_id=user_id, name=name, puzzle_count=puzzle_count)
    db.session.add(subset)
    db.session.commit()
    return subset


def save_config(
    subset_id: int,
    user_id: int,
    puzzle_count: int,
    config: dict[str, object],
) -> Subset:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise PermissionError("Subset is locked.")
    if not (5 <= puzzle_count <= 1000):
        raise ValueError("puzzle_count must be between 5 and 1000.")

    db.session.execute(
        sa.delete(SubsetTrainingItem).where(SubsetTrainingItem.subset_id == subset_id)
    )

    subset.puzzle_count = puzzle_count
    subset.config = config
    db.session.commit()
    return subset


def fill(subset_id: int, user_id: int) -> tuple[int, int]:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise PermissionError("Subset is locked.")
    if subset.config is None or subset.puzzle_count is None:
        raise ValueError("Configuration is not set.")

    db.session.execute(
        sa.delete(SubsetTrainingItem).where(SubsetTrainingItem.subset_id == subset_id)
    )

    filled = _sample_and_insert(
        subset_id=subset_id,
        config=subset.config,
        count=subset.puzzle_count,
    )
    db.session.commit()
    return filled, subset.puzzle_count


def refill(subset_id: int, user_id: int) -> tuple[int, int]:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise PermissionError("Subset is locked.")
    if subset.config is None or subset.puzzle_count is None:
        raise ValueError("Configuration is not set.")

    active_count: int = db.session.execute(
        db.select(db.func.count()).where(SubsetTrainingItem.subset_id == subset_id)
    ).scalar_one()

    needed = subset.puzzle_count - active_count
    if needed <= 0:
        return 0, 0

    filled = _sample_and_insert(
        subset_id=subset_id,
        config=subset.config,
        count=needed,
    )
    db.session.commit()
    return filled, needed


def discard_puzzle(subset_id: int, lichess_puzzle_id: str, user_id: int) -> None:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise PermissionError("Subset is locked.")

    tactic = db.session.execute(
        db.select(LichessTactic).where(LichessTactic.puzzle_id == lichess_puzzle_id)
    ).scalar_one_or_none()
    if tactic is None:
        raise LookupError("Puzzle not found.")

    row = db.session.execute(
        db.select(SubsetTrainingItem).where(
            SubsetTrainingItem.subset_id == subset_id,
            SubsetTrainingItem.training_item_id == tactic.training_item_id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise LookupError("Puzzle is not a member of this subset.")

    db.session.delete(row)
    db.session.commit()


def lock_subset(subset_id: int, user_id: int) -> Subset:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise ValueError("Already locked.")

    active_count: int = db.session.execute(
        db.select(db.func.count()).where(SubsetTrainingItem.subset_id == subset_id)
    ).scalar_one()
    if active_count == 0:
        raise ValueError("Cannot lock a subset with no active puzzles.")

    subset.locked_at = datetime.now(timezone.utc)
    subset.locked_puzzle_count = active_count
    db.session.commit()
    return subset


def list_active_puzzles(
    subset_id: int,
    user_id: int,
    page: int,
    sort: str | None,
    order: str,
) -> dict[str, object]:
    _get_viewable_subset(subset_id, user_id)

    total: int = db.session.execute(
        db.select(db.func.count()).where(SubsetTrainingItem.subset_id == subset_id)
    ).scalar_one()

    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(1, min(page, total_pages))
    offset = (page - 1) * PAGE_SIZE

    sort_col = VALID_SORT_COLUMNS.get(sort or "", "sti.position")
    order_dir = "DESC" if order == "desc" else "ASC"

    rows = db.session.execute(
        sa.text(f"""
            SELECT p.id, p.puzzle_id, p.rating, p.popularity, p.nb_plays, p.game_url,
                   p.training_item_id
            FROM subset_training_items sti
            JOIN lichess_tactics p ON p.training_item_id = sti.training_item_id
            WHERE sti.subset_id = :sid
            ORDER BY {sort_col} {order_dir}
            LIMIT :limit OFFSET :offset
        """),
        {"sid": subset_id, "limit": PAGE_SIZE, "offset": offset},
    ).all()

    if not rows:
        return {"puzzles": [], "page": page, "pageSize": PAGE_SIZE, "totalPages": total_pages, "total": total}

    lichess_tactic_ids = [r.id for r in rows]

    theme_rows = db.session.execute(
        sa.text("""
            SELECT ltl.lichess_tactic_id, t.name, t.display_name
            FROM lichess_tactic_theme_links ltl JOIN lichess_tactic_themes t ON t.id = ltl.lichess_tactic_theme_id
            WHERE ltl.lichess_tactic_id = ANY(:ids)
        """),
        {"ids": lichess_tactic_ids},
    ).all()
    theme_map: dict[int, list[dict[str, str]]] = {}
    for tr in theme_rows:
        theme_map.setdefault(tr.lichess_tactic_id, []).append(
            {"name": tr.name, "displayName": tr.display_name or tr.name}
        )

    opening_rows = db.session.execute(
        sa.text("""
            SELECT lto.lichess_tactic_id, o.name, o.display_name, o.eco
            FROM lichess_tactic_openings lto JOIN openings o ON o.id = lto.opening_id
            WHERE lto.lichess_tactic_id = ANY(:ids)
        """),
        {"ids": lichess_tactic_ids},
    ).all()
    opening_map: dict[int, list[dict[str, str]]] = {}
    for or_ in opening_rows:
        opening_map.setdefault(or_.lichess_tactic_id, []).append(
            {"name": or_.name, "displayName": or_.display_name or or_.name, "eco": or_.eco}
        )

    puzzles = [
        {
            "puzzleId": r.puzzle_id,
            "rating": r.rating,
            "popularity": r.popularity,
            "nbPlays": r.nb_plays,
            "gameUrl": r.game_url,
            "themes": theme_map.get(r.id, []),
            "openings": opening_map.get(r.id, []),
        }
        for r in rows
    ]

    return {"puzzles": puzzles, "page": page, "pageSize": PAGE_SIZE, "totalPages": total_pages, "total": total}


def get_stats(subset_id: int, user_id: int) -> dict[str, object]:
    subset = _get_viewable_subset(subset_id, user_id)

    active_rows = db.session.execute(
        sa.text("""
            SELECT p.id, p.rating, p.popularity, p.nb_plays
            FROM subset_training_items sti JOIN lichess_tactics p ON p.training_item_id = sti.training_item_id
            WHERE sti.subset_id = :sid
        """),
        {"sid": subset_id},
    ).all()

    _rating_val = (subset.config or {}).get("rating")
    rating_cfg: dict[str, object] = _rating_val if isinstance(_rating_val, dict) else {}
    _min = rating_cfg.get("min")
    _max = rating_cfg.get("max")
    rating_min: int | None = int(_min) if isinstance(_min, (int, float)) else None
    rating_max: int | None = int(_max) if isinstance(_max, (int, float)) else None

    if not active_rows:
        rating_buckets: list[dict[str, int]] = []
        if rating_min is not None and rating_max is not None:
            start_bucket = (int(rating_min) // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
            end_bucket = ((int(rating_max) + RATING_BUCKET_SIZE - 1) // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE

            rating_buckets = [
                {"min": b, "max": b + RATING_BUCKET_SIZE, "count": 0}
                for b in range(start_bucket, end_bucket, RATING_BUCKET_SIZE)
            ]

        return {
            "ratingBuckets": rating_buckets,
            "themes": [],
            "openings": [],
            "avgPopularity": 0,
            "avgNbPlays": 0,
            "avgRating": 0,
            "noOpeningCount": 0,
            "totalActive": 0,
            "ratingRange": {
                "min": rating_min,
                "max": rating_max,
                "step": RATING_BUCKET_SIZE,
            },
        }

    int_ids = [r.id for r in active_rows]
    total = len(active_rows)
    avg_popularity = sum(r.popularity for r in active_rows) / total
    avg_nb_plays = sum(r.nb_plays for r in active_rows) / total
    avg_rating = round(sum(r.rating for r in active_rows) / total)

    actual_min = rating_min if rating_min is not None else min(r.rating for r in active_rows)
    actual_max = rating_max if rating_max is not None else max(r.rating for r in active_rows)
    start_bucket = (actual_min // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
    end_bucket = ((actual_max + RATING_BUCKET_SIZE - 1) // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE

    bucket_map: dict[int, int] = {
        b: 0 for b in range(start_bucket, end_bucket, RATING_BUCKET_SIZE)
    }

    for r in active_rows:
        bucket_min = (r.rating // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
        if bucket_min in bucket_map:
            bucket_map[bucket_min] += 1

    rating_buckets = [
        {"min": k, "max": k + RATING_BUCKET_SIZE, "count": v}
        for k, v in sorted(bucket_map.items())
    ]

    theme_rows = db.session.execute(
        sa.text("""
            SELECT t.name, t.display_name, t.description, COUNT(*) AS cnt
            FROM lichess_tactic_theme_links ltl JOIN lichess_tactic_themes t ON t.id = ltl.lichess_tactic_theme_id
            WHERE ltl.lichess_tactic_id = ANY(:ids)
            GROUP BY t.name, t.display_name, t.description
            ORDER BY cnt DESC
        """),
        {"ids": int_ids},
    ).all()
    themes: list[dict[str, object]] = [
        {"name": r.name, "displayName": r.display_name, "description": r.description, "count": r.cnt}
        for r in theme_rows
    ]

    opening_rows = db.session.execute(
        sa.text("""
            SELECT o.name, o.display_name, COUNT(*) AS cnt
            FROM lichess_tactic_openings lto JOIN openings o ON o.id = lto.opening_id
            WHERE lto.lichess_tactic_id = ANY(:ids)
            GROUP BY o.name, o.display_name
            ORDER BY cnt DESC
        """),
        {"ids": int_ids},
    ).all()
    openings: list[dict[str, object]] = [
        {"name": r.name, "displayName": r.display_name, "count": r.cnt} for r in opening_rows
    ]

    with_opening = db.session.execute(
        sa.text("SELECT COUNT(DISTINCT lichess_tactic_id) FROM lichess_tactic_openings WHERE lichess_tactic_id = ANY(:ids)"),
        {"ids": int_ids},
    ).scalar()
    no_opening_count = total - int(with_opening or 0)

    return {
        "ratingBuckets": rating_buckets,
        "themes": themes,
        "openings": openings,
        "avgPopularity": round(avg_popularity, 1),
        "avgNbPlays": round(avg_nb_plays, 1),
        "avgRating": avg_rating,
        "noOpeningCount": no_opening_count,
        "totalActive": total,
        "ratingRange": {
            "min": rating_min,
            "max": rating_max,
            "step": RATING_BUCKET_SIZE,
        },
    }

def list_subsets(user_id: int) -> list[tuple[Subset, User]]:
    rows = db.session.execute(
        db.select(Subset, User)
        .join(User, User.id == Subset.user_id)
        .where(
            sa.or_(
                Subset.user_id == user_id,
                sa.and_(Subset.locked_at.isnot(None), Subset.user_id != user_id),
            )
        )
        .order_by(Subset.created_at.desc())
    ).all()
    return [(row[0], row[1]) for row in rows]


def get_subset(subset_id: int, user_id: int) -> tuple[Subset, User]:
    subset = _get_viewable_subset(subset_id, user_id)
    owner = db.session.get(User, subset.user_id)
    if owner is None:
        raise LookupError("Subset owner not found.")
    return subset, owner


def delete_subset(subset_id: int, user_id: int) -> None:
    subset = _get_owned_subset(subset_id, user_id)
    referenced = db.session.execute(
        sa.select(sa.literal(1)).where(Schedule.subset_id == subset_id).limit(1)
    ).first()
    if referenced is not None:
        raise ValueError("Cannot delete a subset that is referenced by a schedule.")
    db.session.delete(subset)
    db.session.commit()


def _get_owned_subset(subset_id: int, user_id: int) -> Subset:
    subset = db.session.get(Subset, subset_id)
    if subset is None:
        raise LookupError("Subset not found.")
    if subset.user_id != user_id:
        raise PermissionError("Access denied.")
    return subset


def _get_viewable_subset(subset_id: int, user_id: int) -> Subset:
    subset = db.session.get(Subset, subset_id)
    if subset is None:
        raise LookupError("Subset not found.")
    if subset.user_id != user_id and subset.locked_at is None:
        raise PermissionError("Access denied.")
    return subset
