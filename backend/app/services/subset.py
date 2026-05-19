import json
import random
from datetime import datetime, timezone

import sqlalchemy as sa

from app.extensions import db
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
VALID_SOURCES = {"LICHESS_TACTIC", "SCRAPED_POSITIONAL"}


def subset_status(subset: Subset) -> str:
    if subset.locked_at is not None:
        return "locked"
    count = db.session.scalar(
        sa.select(sa.func.count()).where(SubsetTrainingItem.subset_id == subset.id)
    ) or 0
    return "filled" if count > 0 else "draft"


def subset_to_dict(subset: Subset, owner: User | None = None) -> dict[str, object]:
    d: dict[str, object] = {
        "id": subset.id,
        "name": subset.name,
        "status": subset_status(subset),
        "puzzleCount": subset.locked_puzzle_count if subset.locked_puzzle_count is not None else subset.puzzle_count,
        "config": subset.config,
        "createdAt": subset.created_at.isoformat(),
        "lockedAt": subset.locked_at.isoformat() if subset.locked_at else None,
    }
    if owner is not None:
        d["ownedBy"] = {
            "id": owner.id,
            "displayName": owner.display_name,
            "avatarUrl": owner.avatar_url,
        }
    return d


def _validate_sources_config(config: dict[str, object]) -> None:
    sources = config.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("config.sources must be a non-empty array.")
    total_pct = 0
    for entry in sources:
        if not isinstance(entry, dict):
            raise ValueError("Each source entry must be an object.")
        source = entry.get("source")
        if source not in VALID_SOURCES:
            raise ValueError(
                f"Invalid source '{source}'. Must be one of: {', '.join(sorted(VALID_SOURCES))}."
            )
        pct = entry.get("percentage")
        if not isinstance(pct, int) or pct < 1:
            raise ValueError("Each source percentage must be an integer >= 1.")
        total_pct += pct
    if total_pct != 100:
        raise ValueError(f"Source percentages must sum to 100 (got {total_pct}).")


def _distribute_counts(sources: list[dict], total: int) -> list[int]:
    """Largest-remainder distribution so counts sum exactly to total."""
    exact = [total * s["percentage"] / 100 for s in sources]
    floored = [int(v) for v in exact]
    remainder = total - sum(floored)
    fractions = sorted(
        range(len(sources)), key=lambda i: exact[i] - floored[i], reverse=True
    )
    for i in fractions[:remainder]:
        floored[i] += 1
    return floored


def _sample_lichess_tactics(
    config: dict[str, object],
    subset_id: int,
    count: int,
) -> list[int]:
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


def _sample_scraped_positionals(
    config: dict[str, object],
    subset_id: int,
    count: int,
) -> list[int]:
    difficulties_raw = config.get("difficulty")
    difficulties: list[int] = (
        [int(d) for d in difficulties_raw]  # type: ignore[union-attr]
        if isinstance(difficulties_raw, list) and difficulties_raw
        else []
    )

    themes_raw = config.get("themes")
    theme_names: list[str] = (
        [str(t) for t in themes_raw]  # type: ignore[union-attr]
        if isinstance(themes_raw, list) and themes_raw
        else []
    )

    opening_cfg = config.get("opening") or {}
    opening_items: list[str] = []
    opening_strength = 0.0
    if isinstance(opening_cfg, dict):
        items_raw = opening_cfg.get("items", [])
        opening_items = list(items_raw) if isinstance(items_raw, list) else []  # type: ignore[arg-type]
        if opening_items:
            opening_strength = float(opening_cfg.get("strength", 0.0))  # type: ignore[arg-type]

    rows = db.session.execute(
        sa.text("""
            WITH RECURSIVE
            opening_descendants AS (
                SELECT id FROM openings WHERE name = ANY(:opening_keys)
                UNION ALL
                SELECT o.id FROM openings o
                JOIN opening_descendants d ON o.parent_id = d.id
            ),
            eligible AS (
                SELECT ti.id
                FROM training_items ti
                JOIN scraped_positional_puzzles spp ON spp.training_item_id = ti.id
                JOIN scraped_positional_difficulties spd ON spd.id = spp.difficulty_id
                WHERE (:difficulty_count = 0 OR spd.value = ANY(:difficulties))
                  AND ti.id NOT IN (
                      SELECT training_item_id FROM subset_training_items
                      WHERE subset_id = :sid
                  )
            ),
            theme_filtered AS (
                SELECT e.id
                FROM eligible e
                WHERE (:theme_count = 0 OR EXISTS (
                    SELECT 1
                    FROM scraped_positional_puzzles spp2
                    JOIN scraped_positional_theme_links sptl ON sptl.positional_puzzle_id = spp2.id
                    JOIN scraped_positional_themes spt ON spt.id = sptl.positional_theme_id
                    WHERE spp2.training_item_id = e.id
                      AND spt.name = ANY(:theme_names)
                ))
            ),
            weighted AS (
                SELECT
                    tf.id,
                    CASE
                        WHEN :opening_strength = 0 THEN 1.0
                        WHEN EXISTS (
                            SELECT 1 FROM scraped_positional_puzzles spp3
                            WHERE spp3.training_item_id = tf.id
                              AND spp3.opening_id IN (SELECT id FROM opening_descendants)
                        ) THEN 1.0
                        ELSE 1.0 - :opening_strength
                    END AS weight
                FROM theme_filtered tf
            )
            SELECT id
            FROM weighted
            WHERE weight > 0
            ORDER BY ln(random()) / weight DESC
            LIMIT :count
        """),
        {
            "sid": subset_id,
            "difficulties": difficulties,
            "difficulty_count": len(difficulties),
            "theme_names": theme_names,
            "theme_count": len(theme_names),
            "opening_keys": opening_items,
            "opening_strength": opening_strength,
            "count": count,
        },
    ).all()

    return [row.id for row in rows]


def _sample_all_sources(
    sources: list[dict],
    subset_id: int,
    total_count: int,
) -> list[int]:
    counts = _distribute_counts(sources, total_count)
    all_ids: list[int] = []
    for source_entry, count in zip(sources, counts):
        if count == 0:
            continue
        cfg: dict[str, object] = source_entry.get("config") or {}
        source = source_entry["source"]
        if source == "LICHESS_TACTIC":
            ids = _sample_lichess_tactics(cfg, subset_id, count)
        elif source == "SCRAPED_POSITIONAL":
            ids = _sample_scraped_positionals(cfg, subset_id, count)
        else:
            ids = []
        all_ids.extend(ids)
    random.shuffle(all_ids)
    return all_ids


def _sample_and_insert(
    subset_id: int,
    sources: list[dict],
    count: int,
) -> int:
    sampled_ids = _sample_all_sources(sources, subset_id, count)

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
    _validate_sources_config(config)

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

    sources: list[dict] = (subset.config or {}).get("sources", [])  # type: ignore[assignment]
    if not sources:
        raise ValueError("Configuration is not set.")

    db.session.execute(
        sa.delete(SubsetTrainingItem).where(SubsetTrainingItem.subset_id == subset_id)
    )

    filled = _sample_and_insert(
        subset_id=subset_id,
        sources=sources,
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

    sources: list[dict] = (subset.config or {}).get("sources", [])  # type: ignore[assignment]
    if not sources:
        raise ValueError("Configuration is not set.")

    active_count: int = db.session.execute(
        db.select(db.func.count()).where(SubsetTrainingItem.subset_id == subset_id)
    ).scalar_one()

    needed = subset.puzzle_count - active_count
    if needed <= 0:
        return 0, 0

    filled = _sample_and_insert(
        subset_id=subset_id,
        sources=sources,
        count=needed,
    )
    db.session.commit()
    return filled, needed


def discard_puzzle(subset_id: int, training_item_id: int, user_id: int) -> None:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise PermissionError("Subset is locked.")

    row = db.session.execute(
        db.select(SubsetTrainingItem).where(
            SubsetTrainingItem.subset_id == subset_id,
            SubsetTrainingItem.training_item_id == training_item_id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise LookupError("Training item not found in this subset.")

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


def _lichess_stats(
    training_item_ids: list[int],
    config: dict[str, object],
) -> dict[str, object]:
    _rating_val = config.get("rating")
    rating_cfg: dict[str, object] = _rating_val if isinstance(_rating_val, dict) else {}
    _min = rating_cfg.get("min")
    _max = rating_cfg.get("max")
    rating_min: int | None = int(_min) if isinstance(_min, (int, float)) else None
    rating_max: int | None = int(_max) if isinstance(_max, (int, float)) else None

    if not training_item_ids:
        rating_buckets: list[dict[str, int]] = []
        if rating_min is not None and rating_max is not None:
            start = (rating_min // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
            end = ((rating_max + RATING_BUCKET_SIZE - 1) // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
            rating_buckets = [
                {"min": b, "max": b + RATING_BUCKET_SIZE, "count": 0}
                for b in range(start, end, RATING_BUCKET_SIZE)
            ]
        return {
            "count": 0,
            "ratingBuckets": rating_buckets,
            "themes": [],
            "openings": [],
            "avgPopularity": 0,
            "avgNbPlays": 0,
            "avgRating": 0,
            "noOpeningCount": 0,
            "ratingRange": {"min": rating_min, "max": rating_max, "step": RATING_BUCKET_SIZE},
        }

    tactic_rows = db.session.execute(
        sa.text("""
            SELECT lt.id, lt.rating, lt.popularity, lt.nb_plays
            FROM lichess_tactics lt
            WHERE lt.training_item_id = ANY(:ids)
        """),
        {"ids": training_item_ids},
    ).all()

    lt_ids = [r.id for r in tactic_rows]
    count = len(tactic_rows)
    avg_popularity = sum(r.popularity for r in tactic_rows) / count
    avg_nb_plays = sum(r.nb_plays for r in tactic_rows) / count
    avg_rating = round(sum(r.rating for r in tactic_rows) / count)

    actual_min = rating_min if rating_min is not None else min(r.rating for r in tactic_rows)
    actual_max = rating_max if rating_max is not None else max(r.rating for r in tactic_rows)
    start_bucket = (actual_min // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
    end_bucket = ((actual_max + RATING_BUCKET_SIZE - 1) // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
    bucket_map: dict[int, int] = {b: 0 for b in range(start_bucket, end_bucket, RATING_BUCKET_SIZE)}
    for r in tactic_rows:
        b = (r.rating // RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE
        if b in bucket_map:
            bucket_map[b] += 1
    rating_buckets = [
        {"min": k, "max": k + RATING_BUCKET_SIZE, "count": v}
        for k, v in sorted(bucket_map.items())
    ]

    theme_rows = db.session.execute(
        sa.text("""
            SELECT t.name, t.display_name, t.description, COUNT(*) AS cnt
            FROM lichess_tactic_theme_links ltl
            JOIN lichess_tactic_themes t ON t.id = ltl.lichess_tactic_theme_id
            WHERE ltl.lichess_tactic_id = ANY(:ids)
            GROUP BY t.name, t.display_name, t.description
            ORDER BY cnt DESC
        """),
        {"ids": lt_ids},
    ).all()
    themes: list[dict[str, object]] = [
        {"name": r.name, "displayName": r.display_name, "description": r.description, "count": r.cnt}
        for r in theme_rows
    ]

    opening_rows = db.session.execute(
        sa.text("""
            SELECT o.name, o.display_name, COUNT(*) AS cnt
            FROM lichess_tactic_openings lto
            JOIN openings o ON o.id = lto.opening_id
            WHERE lto.lichess_tactic_id = ANY(:ids)
            GROUP BY o.name, o.display_name
            ORDER BY cnt DESC
        """),
        {"ids": lt_ids},
    ).all()
    openings: list[dict[str, object]] = [
        {"name": r.name, "displayName": r.display_name, "count": r.cnt} for r in opening_rows
    ]

    with_opening: int = db.session.execute(
        sa.text("""
            SELECT COUNT(DISTINCT lichess_tactic_id)
            FROM lichess_tactic_openings
            WHERE lichess_tactic_id = ANY(:ids)
        """),
        {"ids": lt_ids},
    ).scalar() or 0

    return {
        "count": count,
        "ratingBuckets": rating_buckets,
        "themes": themes,
        "openings": openings,
        "avgPopularity": round(avg_popularity, 1),
        "avgNbPlays": round(avg_nb_plays, 1),
        "avgRating": avg_rating,
        "noOpeningCount": count - with_opening,
        "ratingRange": {"min": rating_min, "max": rating_max, "step": RATING_BUCKET_SIZE},
    }


def _positional_stats(training_item_ids: list[int]) -> dict[str, object]:
    if not training_item_ids:
        return {"count": 0, "difficultyDistribution": [], "themes": [], "openings": []}

    diff_rows = db.session.execute(
        sa.text("""
            SELECT spd.value, spd.label, COUNT(*) AS cnt
            FROM scraped_positional_puzzles spp
            JOIN scraped_positional_difficulties spd ON spd.id = spp.difficulty_id
            WHERE spp.training_item_id = ANY(:ids)
            GROUP BY spd.value, spd.label
            ORDER BY spd.value
        """),
        {"ids": training_item_ids},
    ).all()
    difficulty_distribution: list[dict[str, object]] = [
        {"value": r.value, "label": r.label, "count": r.cnt} for r in diff_rows
    ]

    theme_rows = db.session.execute(
        sa.text("""
            SELECT spt.name, spt.display_name, COUNT(*) AS cnt
            FROM scraped_positional_puzzles spp
            JOIN scraped_positional_theme_links sptl ON sptl.positional_puzzle_id = spp.id
            JOIN scraped_positional_themes spt ON spt.id = sptl.positional_theme_id
            WHERE spp.training_item_id = ANY(:ids)
            GROUP BY spt.name, spt.display_name
            ORDER BY cnt DESC
        """),
        {"ids": training_item_ids},
    ).all()
    themes: list[dict[str, object]] = [
        {"name": r.name, "displayName": r.display_name, "count": r.cnt} for r in theme_rows
    ]

    opening_rows = db.session.execute(
        sa.text("""
            SELECT o.name, o.display_name, COUNT(*) AS cnt
            FROM scraped_positional_puzzles spp
            JOIN openings o ON o.id = spp.opening_id
            WHERE spp.training_item_id = ANY(:ids)
              AND spp.opening_id IS NOT NULL
            GROUP BY o.name, o.display_name
            ORDER BY cnt DESC
        """),
        {"ids": training_item_ids},
    ).all()
    openings: list[dict[str, object]] = [
        {"name": r.name, "displayName": r.display_name, "count": r.cnt} for r in opening_rows
    ]

    return {
        "count": len(training_item_ids),
        "difficultyDistribution": difficulty_distribution,
        "themes": themes,
        "openings": openings,
    }


def get_stats(subset_id: int, user_id: int) -> dict[str, object]:
    subset = _get_viewable_subset(subset_id, user_id)

    item_rows = db.session.execute(
        sa.text("""
            SELECT ti.id, ti.source_type::text AS source_type
            FROM subset_training_items sti
            JOIN training_items ti ON ti.id = sti.training_item_id
            WHERE sti.subset_id = :sid
        """),
        {"sid": subset_id},
    ).all()

    total = len(item_rows)
    by_source: dict[str, list[int]] = {}
    for r in item_rows:
        by_source.setdefault(r.source_type, []).append(r.id)

    sources_config: list[dict] = (subset.config or {}).get("sources", [])  # type: ignore[assignment]
    configured_sources = {s["source"] for s in sources_config if isinstance(s, dict) and "source" in s}

    sources_out: dict[str, object] = {}

    if "LICHESS_TACTIC" in configured_sources or "LICHESS_TACTIC" in by_source:
        lt_config: dict[str, object] = next(
            (s.get("config") or {} for s in sources_config if s.get("source") == "LICHESS_TACTIC"),
            {},
        )
        sources_out["LICHESS_TACTIC"] = _lichess_stats(
            by_source.get("LICHESS_TACTIC", []), lt_config
        )

    if "SCRAPED_POSITIONAL" in configured_sources or "SCRAPED_POSITIONAL" in by_source:
        sources_out["SCRAPED_POSITIONAL"] = _positional_stats(
            by_source.get("SCRAPED_POSITIONAL", [])
        )

    return {"sources": sources_out, "totalActive": total}

def list_subsets(user_id: int, locked_only: bool = False) -> list[tuple[Subset, User]]:
    where_clause: sa.ColumnElement[bool]
    if locked_only:
        where_clause = Subset.locked_at.isnot(None)
    else:
        where_clause = sa.or_(
            Subset.user_id == user_id,
            sa.and_(Subset.locked_at.isnot(None), Subset.user_id != user_id),
        )
    rows = db.session.execute(
        db.select(Subset, User)
        .join(User, User.id == Subset.user_id)
        .where(where_clause)
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
