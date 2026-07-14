import json
import random
from datetime import datetime, timezone
from typing import Any

import sqlalchemy as sa

from app.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.table_query import DateFilter, FilterList, RangeFilter
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
VALID_SOURCES = {"LICHESS_TACTIC", "SCRAPED_POSITIONAL", "DECOY"}


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


def _validate_config(config: dict[str, object]) -> None:
    sources = config.get("sources") or []
    subset_refs = config.get("subsetRefs") or []
    exclude_subsets = config.get("excludeSubsets") or []

    if not isinstance(sources, list):
        raise ValidationError("Invalid sources", "Sources must be a list.")
    if not isinstance(subset_refs, list):
        raise ValidationError("Invalid subsetRefs", "SubsetRefs must be a list.")
    if not isinstance(exclude_subsets, list):
        raise ValidationError("Invalid excludeSubsets", "ExcludedSubsets must be a list.")

    if not sources and not subset_refs:
        raise ValidationError("Sources required", "At least one source or subset reference must be configured.")

    total_pct = 0

    for entry in sources:
        if not isinstance(entry, dict):
            raise ValidationError("Invalid source", "Each source entry must be a valid object.")
        source = entry.get("source")
        if source not in VALID_SOURCES:
            raise ValidationError("Unknown source type", "The specified source type is not supported.")
        pct = entry.get("percentage")
        if not isinstance(pct, int) or pct < 1:
            raise ValidationError("Invalid percentage", "Each source percentage must be a whole number of at least 1.")
        total_pct += pct

    ref_ids: list[int] = []
    for entry in subset_refs:
        if not isinstance(entry, dict):
            raise ValidationError("Invalid subset reference", "Each subset reference must be a valid object.")
        sid_raw = entry.get("subsetId")
        if not isinstance(sid_raw, int):
            raise ValidationError("Invalid subset reference", "Each subset reference must have a valid integer subsetId.")
        pct = entry.get("percentage")
        if not isinstance(pct, int) or pct < 1:
            raise ValidationError("Invalid percentage", "Each subset reference percentage must be a whole number of at least 1.")
        total_pct += pct
        excl_srcs = entry.get("excludeSources")
        if excl_srcs is not None:
            if not isinstance(excl_srcs, list):
                raise ValidationError("Invalid excludeSources", "excludeSources must be a list of source type strings.")
            for s in excl_srcs:
                if s not in VALID_SOURCES:
                    raise ValidationError("Unknown source type in excludeSources", f"'{s}' is not a valid source type.")
        ref_ids.append(sid_raw)

    if total_pct != 100:
        raise ValidationError("Invalid percentages", f"Source percentages must sum to 100, but they sum to {total_pct}.")

    exclude_ids: list[int] = []
    for eid in exclude_subsets:
        if not isinstance(eid, int):
            raise ValidationError("Invalid excludeSubsets", "Each entry in excludeSubsets must be an integer subset ID.")
        exclude_ids.append(eid)

    overlap = set(ref_ids) & set(exclude_ids)
    if overlap:
        raise ValidationError(
            "Contradictory configuration",
            "The same subset cannot appear in both subsetRefs and excludeSubsets.",
        )

    all_ids_to_check = list(set(ref_ids + exclude_ids))
    if all_ids_to_check:
        locked_ids = {
            row.id
            for row in db.session.execute(
                sa.text("SELECT id FROM subsets WHERE id = ANY(:ids) AND locked_at IS NOT NULL"),
                {"ids": all_ids_to_check},
            ).all()
        }
        for sid in ref_ids:
            if sid not in locked_ids:
                raise ValidationError(
                    "Invalid subset reference",
                    f"Subset {sid} does not exist or is not locked.",
                )
        for sid in exclude_ids:
            if sid not in locked_ids:
                raise ValidationError(
                    "Invalid excluded subset",
                    f"Subset {sid} does not exist or is not locked.",
                )


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
    exclude_ti_ids: list[int] | None = None,
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
                  AND (:excl_count = 0 OR ti.id != ALL(:excl_ids))
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
                    COALESCE(ts.score, 1.0)
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
            "excl_ids": exclude_ti_ids or [],
            "excl_count": len(exclude_ti_ids) if exclude_ti_ids else 0,
        },
    ).all()

    return [row.id for row in rows]


def _sample_scraped_positionals(
    config: dict[str, object],
    subset_id: int,
    count: int,
    exclude_ti_ids: list[int] | None = None,
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
                  AND (:excl_count = 0 OR ti.id != ALL(:excl_ids))
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
            "excl_ids": exclude_ti_ids or [],
            "excl_count": len(exclude_ti_ids) if exclude_ti_ids else 0,
        },
    ).all()

    return [row.id for row in rows]


def _sample_decoys(
    config: dict[str, object],
    subset_id: int,
    count: int,
    exclude_ti_ids: list[int] | None = None,
) -> list[int]:
    opening_cfg = config.get("opening") or {}
    opening_items: list[str] = []
    opening_strength = 0.0
    if isinstance(opening_cfg, dict):
        items_raw = opening_cfg.get("items", [])
        opening_items = list(items_raw) if isinstance(items_raw, list) else []  # type: ignore[arg-type]
        if opening_items:
            opening_strength = float(opening_cfg.get("strength", 0.0))  # type: ignore[arg-type]

    counts_raw = config.get("acceptedMovesCounts")
    accepted_counts: list[int] = (
        [int(c) for c in counts_raw if isinstance(c, int)]
        if isinstance(counts_raw, list) and len(counts_raw) > 0
        else []
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
            eligible AS (
                SELECT ti.id
                FROM training_items ti
                JOIN decoy_puzzles dp ON dp.training_item_id = ti.id
                WHERE ti.id NOT IN (
                    SELECT training_item_id FROM subset_training_items
                    WHERE subset_id = :sid
                )
                  AND (:counts_len = 0 OR jsonb_array_length(dp.accepted_moves) = ANY(:accepted_counts))
                  AND (:excl_count = 0 OR ti.id != ALL(:excl_ids))
            ),
            weighted AS (
                SELECT
                    e.id,
                    CASE
                        WHEN :opening_strength = 0 THEN 1.0
                        WHEN EXISTS (
                            SELECT 1 FROM decoy_puzzles dp2
                            JOIN games g2 ON g2.id = dp2.game_id
                            WHERE dp2.training_item_id = e.id
                              AND g2.opening_id IN (SELECT id FROM opening_descendants)
                        ) THEN 1.0
                        ELSE 1.0 - :opening_strength
                    END AS weight
                FROM eligible e
            )
            SELECT id
            FROM weighted
            WHERE weight > 0
            ORDER BY ln(random()) / weight DESC
            LIMIT :count
        """),
        {
            "sid": subset_id,
            "opening_keys": opening_items,
            "opening_strength": opening_strength,
            "accepted_counts": accepted_counts,
            "counts_len": len(accepted_counts),
            "count": count,
            "excl_ids": exclude_ti_ids or [],
            "excl_count": len(exclude_ti_ids) if exclude_ti_ids else 0,
        },
    ).all()

    return [row.id for row in rows]


def _resolve_excluded_ti_ids(exclude_subset_ids: list[int]) -> list[int]:
    if not exclude_subset_ids:
        return []
    rows = db.session.execute(
        sa.text("SELECT training_item_id FROM subset_training_items WHERE subset_id = ANY(:ids)"),
        {"ids": exclude_subset_ids},
    ).all()
    return [row.training_item_id for row in rows]


def _sample_subset_ref(
    ref_entry: dict[str, object],
    subset_id: int,
    count: int,
    exclude_ti_ids: list[int] | None = None,
) -> list[int]:
    ref_id = int(ref_entry["subsetId"])  # type: ignore[call-overload]
    excl_srcs_raw = ref_entry.get("excludeSources") or []
    excl_srcs: list[str] = [str(s) for s in excl_srcs_raw] if isinstance(excl_srcs_raw, list) else []

    rows = db.session.execute(
        sa.text("""
            SELECT sti.training_item_id
            FROM subset_training_items sti
            JOIN training_items ti ON ti.id = sti.training_item_id
            WHERE sti.subset_id = :ref_id
              AND (:excl_src_count = 0 OR ti.source_type::text != ALL(:excl_srcs))
              AND sti.training_item_id NOT IN (
                  SELECT training_item_id FROM subset_training_items
                  WHERE subset_id = :sid
              )
              AND (:excl_count = 0 OR sti.training_item_id != ALL(:excl_ids))
            ORDER BY random()
            LIMIT :count
        """),
        {
            "ref_id": ref_id,
            "sid": subset_id,
            "excl_srcs": excl_srcs,
            "excl_src_count": len(excl_srcs),
            "excl_ids": exclude_ti_ids or [],
            "excl_count": len(exclude_ti_ids) if exclude_ti_ids else 0,
            "count": count,
        },
    ).all()

    return [row.training_item_id for row in rows]


def _sample_all_sources(
    sources: list[dict],
    subset_id: int,
    total_count: int,
    subset_refs: list[dict] | None = None,
    exclude_subset_ids: list[int] | None = None,
) -> list[int]:
    _subset_refs = subset_refs or []
    exclude_ti_ids = _resolve_excluded_ti_ids(exclude_subset_ids or [])

    all_entries: list[dict] = [*sources, *_subset_refs]
    counts = _distribute_counts(all_entries, total_count)

    all_ids: list[int] = []
    for entry, count in zip(all_entries, counts):
        if count == 0:
            continue
        if "subsetId" in entry:
            ids = _sample_subset_ref(entry, subset_id, count, exclude_ti_ids)
        else:
            cfg: dict[str, object] = entry.get("config") or {}
            source = entry["source"]
            if source == "LICHESS_TACTIC":
                ids = _sample_lichess_tactics(cfg, subset_id, count, exclude_ti_ids)
            elif source == "SCRAPED_POSITIONAL":
                ids = _sample_scraped_positionals(cfg, subset_id, count, exclude_ti_ids)
            elif source == "DECOY":
                ids = _sample_decoys(cfg, subset_id, count, exclude_ti_ids)
            else:
                ids = []
        all_ids.extend(ids)
    random.shuffle(all_ids)
    return all_ids


def _sample_and_insert(
    subset_id: int,
    sources: list[dict],
    count: int,
    subset_refs: list[dict] | None = None,
    exclude_subset_ids: list[int] | None = None,
) -> int:
    sampled_ids = _sample_all_sources(sources, subset_id, count, subset_refs, exclude_subset_ids)

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
        raise ValidationError("Name required", "Please provide a name for the subset.")
    if not (5 <= puzzle_count <= 1000):
        raise ValidationError("Invalid puzzle count", "The puzzle count must be between 5 and 1,000.")
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
        raise ConflictError("Subset is locked", "This subset has been locked and can no longer be modified.")
    if not (5 <= puzzle_count <= 1000):
        raise ValidationError("Invalid puzzle count", "The puzzle count must be between 5 and 1,000.")
    _validate_config(config)

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
        raise ConflictError("Subset is locked", "This subset has been locked and can no longer be modified.")
    if subset.config is None or subset.puzzle_count is None:
        raise ValidationError("Configuration required", "A configuration must be set before performing this action.")

    cfg = subset.config or {}
    sources: list[dict] = cfg.get("sources", [])  # type: ignore[assignment]
    subset_refs: list[dict] = cfg.get("subsetRefs", [])  # type: ignore[assignment]
    exclude_subset_ids: list[int] = cfg.get("excludeSubsets", [])  # type: ignore[assignment]
    if not sources and not subset_refs:
        raise ValidationError("Configuration required", "A configuration must be set before performing this action.")

    db.session.execute(
        sa.delete(SubsetTrainingItem).where(SubsetTrainingItem.subset_id == subset_id)
    )

    filled = _sample_and_insert(
        subset_id=subset_id,
        sources=sources,
        count=subset.puzzle_count,
        subset_refs=subset_refs,
        exclude_subset_ids=exclude_subset_ids,
    )
    db.session.commit()
    return filled, subset.puzzle_count


def refill(subset_id: int, user_id: int) -> tuple[int, int]:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise ConflictError("Subset is locked", "This subset has been locked and can no longer be modified.")
    if subset.config is None or subset.puzzle_count is None:
        raise ValidationError("Configuration required", "A configuration must be set before performing this action.")

    cfg = subset.config or {}
    sources: list[dict] = cfg.get("sources", [])  # type: ignore[assignment]
    subset_refs: list[dict] = cfg.get("subsetRefs", [])  # type: ignore[assignment]
    exclude_subset_ids: list[int] = cfg.get("excludeSubsets", [])  # type: ignore[assignment]
    if not sources and not subset_refs:
        raise ValidationError("Configuration required", "A configuration must be set before performing this action.")

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
        subset_refs=subset_refs,
        exclude_subset_ids=exclude_subset_ids,
    )
    db.session.commit()
    return filled, needed


def discard_puzzle(subset_id: int, training_item_id: int, user_id: int) -> None:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise ConflictError("Subset is locked", "This subset has been locked and can no longer be modified.")

    row = db.session.execute(
        db.select(SubsetTrainingItem).where(
            SubsetTrainingItem.subset_id == subset_id,
            SubsetTrainingItem.training_item_id == training_item_id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this subset.")

    db.session.delete(row)
    db.session.commit()


def lock_subset(subset_id: int, user_id: int) -> Subset:
    subset = _get_owned_subset(subset_id, user_id)
    if subset.locked_at is not None:
        raise ConflictError("Already locked", "This subset is already locked.")

    active_count: int = db.session.execute(
        db.select(db.func.count()).where(SubsetTrainingItem.subset_id == subset_id)
    ).scalar_one()
    if active_count == 0:
        raise ValidationError("No puzzles", "A subset must have at least one puzzle before it can be locked.")

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

    # For mixed-source subsets, sort is only meaningful for lichess-specific columns.
    # Fall back to insertion order when the sort column doesn't apply universally.
    sort_col = VALID_SORT_COLUMNS.get(sort or "", "sti.position")
    order_dir = "DESC" if order == "desc" else "ASC"

    # Fetch the paginated training item IDs across all source types.
    ti_rows = db.session.execute(
        sa.text(f"""
            SELECT sti.training_item_id, ti.source_type::text AS source_type
            FROM subset_training_items sti
            JOIN training_items ti ON ti.id = sti.training_item_id
            LEFT JOIN lichess_tactics lt ON lt.training_item_id = sti.training_item_id
            WHERE sti.subset_id = :sid
            ORDER BY {sort_col} {order_dir}
            LIMIT :limit OFFSET :offset
        """),
        {"sid": subset_id, "limit": PAGE_SIZE, "offset": offset},
    ).all()

    if not ti_rows:
        return {"puzzles": [], "page": page, "pageSize": PAGE_SIZE, "totalPages": total_pages, "total": total}

    lichess_ti_ids = [r.training_item_id for r in ti_rows if r.source_type == "LICHESS_TACTIC"]
    positional_ti_ids = [r.training_item_id for r in ti_rows if r.source_type == "SCRAPED_POSITIONAL"]
    decoy_ti_ids = [r.training_item_id for r in ti_rows if r.source_type == "DECOY"]

    # ── Lichess tactics ──────────────────────────────────────────────────────
    lichess_rows = db.session.execute(
        sa.text("""
            SELECT p.id, p.puzzle_id, p.rating, p.popularity, p.nb_plays, p.game_url,
                   p.training_item_id
            FROM lichess_tactics p
            WHERE p.training_item_id = ANY(:ids)
        """),
        {"ids": lichess_ti_ids},
    ).all() if lichess_ti_ids else []

    lichess_by_ti: dict[int, Any] = {r.training_item_id: r for r in lichess_rows}
    lichess_ids = [r.id for r in lichess_rows]

    lt_theme_map: dict[int, list[dict[str, str]]] = {}
    lt_opening_map: dict[int, list[dict[str, str]]] = {}
    if lichess_ids:
        for tr in db.session.execute(
            sa.text("""
                SELECT ltl.lichess_tactic_id, t.name, t.display_name
                FROM lichess_tactic_theme_links ltl
                JOIN lichess_tactic_themes t ON t.id = ltl.lichess_tactic_theme_id
                WHERE ltl.lichess_tactic_id = ANY(:ids)
            """),
            {"ids": lichess_ids},
        ).all():
            lt_theme_map.setdefault(tr.lichess_tactic_id, []).append(
                {"name": tr.name, "displayName": tr.display_name or tr.name}
            )
        for or_ in db.session.execute(
            sa.text("""
                SELECT lto.lichess_tactic_id, o.name, o.display_name, o.eco
                FROM lichess_tactic_openings lto
                JOIN openings o ON o.id = lto.opening_id
                WHERE lto.lichess_tactic_id = ANY(:ids)
            """),
            {"ids": lichess_ids},
        ).all():
            lt_opening_map.setdefault(or_.lichess_tactic_id, []).append(
                {"name": or_.name, "displayName": or_.display_name or or_.name, "eco": or_.eco}
            )

    # ── Scraped positionals ──────────────────────────────────────────────────
    positional_rows = db.session.execute(
        sa.text("""
            SELECT p.id, p.internal_id, p.lichess_url, p.training_item_id,
                   d.value AS difficulty, d.label AS difficulty_label,
                   d.min_rating AS difficulty_min_rating, d.max_rating AS difficulty_max_rating,
                   o.name AS opening_name, o.display_name AS opening_display_name, o.eco AS opening_eco
            FROM scraped_positional_puzzles p
            JOIN scraped_positional_difficulties d ON d.id = p.difficulty_id
            LEFT JOIN openings o ON o.id = p.opening_id
            WHERE p.training_item_id = ANY(:ids)
        """),
        {"ids": positional_ti_ids},
    ).all() if positional_ti_ids else []

    positional_by_ti: dict[int, Any] = {r.training_item_id: r for r in positional_rows}
    positional_ids = [r.id for r in positional_rows]

    sp_theme_map: dict[int, list[dict[str, str]]] = {}
    if positional_ids:
        for tr in db.session.execute(
            sa.text("""
                SELECT sptl.positional_puzzle_id, t.name, t.display_name
                FROM scraped_positional_theme_links sptl
                JOIN scraped_positional_themes t ON t.id = sptl.positional_theme_id
                WHERE sptl.positional_puzzle_id = ANY(:ids)
            """),
            {"ids": positional_ids},
        ).all():
            sp_theme_map.setdefault(tr.positional_puzzle_id, []).append(
                {"name": tr.name, "displayName": tr.display_name or tr.name}
            )

    # ── Decoys ───────────────────────────────────────────────────────────────
    decoy_rows = db.session.execute(
        sa.text("""
            SELECT dp.id, dp.training_item_id, dp.best_cp, dp.analysis_url,
                   o.name AS opening_name, o.display_name AS opening_display_name, o.eco AS opening_eco
            FROM decoy_puzzles dp
            LEFT JOIN games g ON g.id = dp.game_id
            LEFT JOIN openings o ON o.id = g.opening_id
            WHERE dp.training_item_id = ANY(:ids)
        """),
        {"ids": decoy_ti_ids},
    ).all() if decoy_ti_ids else []

    decoy_by_ti: dict[int, Any] = {r.training_item_id: r for r in decoy_rows}

    # ── Assemble in original page order ─────────────────────────────────────
    puzzles: list[dict[str, object]] = []
    for ti_row in ti_rows:
        ti_id = ti_row.training_item_id
        if ti_row.source_type == "LICHESS_TACTIC":
            r = lichess_by_ti.get(ti_id)
            if r is None:
                continue
            puzzles.append({
                "sourceType": "LICHESS_TACTIC",
                "trainingItemId": ti_id,
                "puzzleId": r.puzzle_id,
                "rating": r.rating,
                "popularity": r.popularity,
                "nbPlays": r.nb_plays,
                "gameUrl": r.game_url,
                "themes": lt_theme_map.get(r.id, []),
                "openings": lt_opening_map.get(r.id, []),
            })
        elif ti_row.source_type == "SCRAPED_POSITIONAL":
            r = positional_by_ti.get(ti_id)
            if r is None:
                continue
            opening = (
                {"name": r.opening_name, "displayName": r.opening_display_name or r.opening_name, "eco": r.opening_eco}
                if r.opening_name else None
            )
            puzzles.append({
                "sourceType": "SCRAPED_POSITIONAL",
                "trainingItemId": ti_id,
                "internalId": r.internal_id,
                "lichessUrl": r.lichess_url,
                "difficulty": r.difficulty,
                "difficultyLabel": r.difficulty_label,
                "difficultyMinRating": r.difficulty_min_rating,
                "difficultyMaxRating": r.difficulty_max_rating,
                "themes": sp_theme_map.get(r.id, []),
                "opening": opening,
            })
        elif ti_row.source_type == "DECOY":
            r = decoy_by_ti.get(ti_id)
            if r is None:
                continue
            opening = (
                {"name": r.opening_name, "displayName": r.opening_display_name or r.opening_name, "eco": r.opening_eco}
                if r.opening_name else None
            )
            puzzles.append({
                "sourceType": "DECOY",
                "trainingItemId": ti_id,
                "bestCp": r.best_cp,
                "analysisUrl": r.analysis_url,
                "opening": opening,
            })

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


def _decoy_stats(training_item_ids: list[int]) -> dict[str, object]:
    if not training_item_ids:
        return {"count": 0, "openings": []}

    opening_rows = db.session.execute(
        sa.text("""
            SELECT o.name, o.display_name, COUNT(*) AS cnt
            FROM decoy_puzzles dp
            LEFT JOIN games g ON g.id = dp.game_id
            LEFT JOIN openings o ON o.id = g.opening_id
            WHERE dp.training_item_id = ANY(:ids)
              AND o.name IS NOT NULL
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

    if "DECOY" in configured_sources or "DECOY" in by_source:
        sources_out["DECOY"] = _decoy_stats(by_source.get("DECOY", []))

    return {"sources": sources_out, "totalActive": total}

def suggest_subsets(limit: int = 8) -> list[dict[str, object]]:
    rows = db.session.scalars(
        sa.select(Subset).order_by(Subset.created_at.desc()).limit(limit)
    ).all()
    return [{"id": s.id, "name": s.name, "status": subset_status(s)} for s in rows]


def search_subsets(q: str, limit: int = 10) -> list[dict[str, object]]:
    rows = db.session.scalars(
        sa.select(Subset)
        .where(Subset.name.ilike(f"%{q}%"))
        .order_by(Subset.name)
        .limit(limit)
    ).all()
    return [{"id": s.id, "name": s.name, "status": subset_status(s)} for s in rows]


def get_subsets_by_ids(ids: list[int]) -> list[dict[str, object]]:
    if not ids:
        return []
    rows = db.session.scalars(sa.select(Subset).where(Subset.id.in_(ids))).all()
    return [{"id": s.id, "name": s.name, "status": subset_status(s)} for s in rows]


def list_subsets(
    user_id: int,
    locked_only: bool = False,
    statuses: list[str] | None = None,
    statuses_op: str = 'is',
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    user_ids: FilterList | None = None,
    date: DateFilter | None = None,
    puzzle_count: RangeFilter | None = None,
) -> dict[str, object]:
    if locked_only:
        access_clause = "sub.locked_at IS NOT NULL"
    else:
        access_clause = "(sub.user_id = :uid OR (sub.locked_at IS NOT NULL AND sub.user_id != :uid))"

    params: dict[str, object] = {"uid": user_id}
    conditions: list[str] = [access_clause]

    if search:
        conditions.append("sub.name ILIKE :search")
        params["search"] = f"%{search}%"
    if user_ids is not None:
        user_ids.apply(conditions, params, "sub.user_id", prefix="uid")
    if date is not None:
        date.apply(conditions, params, "DATE(COALESCE(sub.locked_at, sub.created_at))", prefix="date")
    if puzzle_count is not None:
        puzzle_count.apply(conditions, params, "COALESCE(sub.locked_puzzle_count, sub.puzzle_count)", prefix="pc", as_int=True)
    if statuses and not locked_only:
        status_parts: list[str] = []
        if "locked" in statuses:
            status_parts.append("sub.locked_at IS NOT NULL")
        if "filled" in statuses:
            status_parts.append(
                "(sub.locked_at IS NULL AND EXISTS "
                "(SELECT 1 FROM subset_training_items sti WHERE sti.subset_id = sub.id))"
            )
        if "draft" in statuses:
            status_parts.append(
                "(sub.locked_at IS NULL AND NOT EXISTS "
                "(SELECT 1 FROM subset_training_items sti WHERE sti.subset_id = sub.id))"
            )
        if status_parts:
            inner = ' OR '.join(status_parts)
            if statuses_op == 'is_not':
                conditions.append(f"NOT ({inner})")
            else:
                conditions.append(f"({inner})")

    where_sql = "WHERE " + " AND ".join(conditions)
    base_sql = f"""
        FROM subsets sub
        JOIN users u ON u.id = sub.user_id
        {where_sql}
    """

    if locked_only:
        total: int | None = None
        limit_clause = ""
    else:
        total = int(db.session.execute(sa.text(f"SELECT COUNT(*) {base_sql}"), params).scalar_one())
        offset = (page - 1) * page_size
        limit_clause = f"LIMIT {page_size} OFFSET {offset}"

    has_trained_col = ""
    if locked_only:
        has_trained_col = """,
                   EXISTS (
                       SELECT 1 FROM trainings t
                       JOIN schedules s ON s.id = t.schedule_id
                       JOIN runs r ON r.training_id = t.id
                       WHERE s.subset_id = sub.id
                         AND t.user_id = :uid
                         AND r.completed_at IS NOT NULL
                   ) AS has_trained"""

    rows = db.session.execute(
        sa.text(f"""
            SELECT sub.id, sub.name, sub.config,
                   COALESCE(sub.locked_puzzle_count, sub.puzzle_count) AS puzzle_count,
                   sub.created_at, sub.locked_at,
                   u.id AS owner_id, u.display_name, u.avatar_url,
                   CASE
                       WHEN sub.locked_at IS NOT NULL THEN 'locked'
                       WHEN EXISTS (
                           SELECT 1 FROM subset_training_items sti
                           WHERE sti.subset_id = sub.id LIMIT 1
                       ) THEN 'filled'
                       ELSE 'draft'
                   END AS status{has_trained_col}
            {base_sql}
            ORDER BY sub.created_at DESC
            {limit_clause}
        """),
        params,
    ).all()

    items: list[dict[str, object]] = []
    for row in rows:
        item: dict[str, object] = {
            "id": row.id,
            "name": row.name,
            "status": row.status,
            "puzzleCount": row.puzzle_count,
            "config": row.config,
            "createdAt": row.created_at.isoformat(),
            "lockedAt": row.locked_at.isoformat() if row.locked_at else None,
            "ownedBy": {
                "id": row.owner_id,
                "displayName": row.display_name,
                "avatarUrl": row.avatar_url,
            },
        }
        if locked_only:
            item["hasTrained"] = bool(row.has_trained)
        items.append(item)

    return {"items": items, "total": total if total is not None else len(items)}


def get_subset(subset_id: int, user_id: int) -> tuple[Subset, User]:
    subset = _get_viewable_subset(subset_id, user_id)
    owner = db.session.get(User, subset.user_id)
    if owner is None:
        raise NotFoundError("User not found", "The subset owner's account could not be found.")
    return subset, owner


def delete_subset(subset_id: int, user_id: int) -> None:
    subset = _get_owned_subset(subset_id, user_id)
    referenced = db.session.execute(
        sa.select(sa.literal(1)).where(Schedule.subset_id == subset_id).limit(1)
    ).first()
    if referenced is not None:
        raise ConflictError("Subset in use", "This subset is referenced by one or more schedules and cannot be deleted.")
    db.session.delete(subset)
    db.session.commit()


def _get_owned_subset(subset_id: int, user_id: int) -> Subset:
    subset = db.session.get(Subset, subset_id)
    if subset is None:
        raise NotFoundError("Subset not found", "The requested subset does not exist or has been deleted.")
    if subset.user_id != user_id:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    return subset


def _get_viewable_subset(subset_id: int, user_id: int) -> Subset:
    subset = db.session.get(Subset, subset_id)
    if subset is None:
        raise NotFoundError("Subset not found", "The requested subset does not exist or has been deleted.")
    if subset.user_id != user_id and subset.locked_at is None:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    return subset
