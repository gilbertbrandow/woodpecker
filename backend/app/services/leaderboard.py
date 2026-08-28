from __future__ import annotations

import sqlalchemy as sa

from app.extensions import db
from app.table_query import (
    DateFilter,
    FilterList,
    Paginator,
    RangeFilter,
    SetFilter,
    SortParam,
)

_EMPTY_FILTER = FilterList(op='is')

_STATUS_SQL = {
    'active':    'r.completed_at IS NULL AND r.aborted_at IS NULL',
    'completed': 'r.completed_at IS NOT NULL AND r.aborted_at IS NULL',
    'aborted':   'r.aborted_at IS NOT NULL',
}

# Sort allowlists — exported so the route can call q.sort_param(ALLOWLIST)
RUN_BOARD_SORT_ALLOWLIST: dict[str, str] = {
    'accuracyPct':      'accuracy_pct',
    'deltaAccuracyPct': 'delta_accuracy_pct',
    'avgRating':        'rs.avg_rating',
    'avgSolveTimeMs':   'rs.avg_solve_time_ms',
    'avgTimeSolvedMs':  'rs.avg_time_solved_ms',
    'avgTimeFailedMs':  'rs.avg_time_failed_ms',
    'resolvedCount':    'COALESCE(rs.resolved_count, 0)',
}

WEEKLY_BOARD_SORT_ALLOWLIST: dict[str, str] = {
    'puzzlesAttempted':    'COALESCE(ws.resolved_count, 0)',
    'lichessTacticPct':    'lichess_tactic_pct',
    'scrapedPositionalPct': 'scraped_positional_pct',
    'decoyPct':            'decoy_pct',
    'avgRating':           'ws.avg_rating',
    'avgAccuracyPct':      'avg_accuracy_pct',
    'avgSolveTimeMs':      'ws.avg_solve_time_ms',
}


def get_run_board(
    schedule_filter: FilterList | None = None,
    user_filter: FilterList | None = None,
    status_filter: FilterList | None = None,
    started_filter: DateFilter | None = None,
    avg_rating_filter: RangeFilter | None = None,
    resolved_filter: RangeFilter | None = None,
    run_index: int | None = None,
    exclude_aborted: bool = False,
    search: str | None = None,
    paginator: Paginator | None = None,
    sort: SortParam | None = None,
) -> tuple[list[dict[str, object]], int]:
    if paginator is None:
        paginator = Paginator(page=1, page_size=50)
    sch_f = schedule_filter or _EMPTY_FILTER
    usr_f = user_filter or _EMPTY_FILTER
    sta_f = status_filter or _EMPTY_FILTER

    conditions: list[str] = []
    params: dict[str, object] = {}

    sch_f.apply(conditions, params, "t.schedule_id", prefix="sched")
    usr_f.apply(conditions, params, "u.id", prefix="usr")

    if run_index is not None:
        conditions.append("r.run_index = :run_index")
        params["run_index"] = run_index
    if exclude_aborted:
        conditions.append("r.aborted_at IS NULL")
    if search:
        conditions.append("(u.display_name ILIKE :q OR s.name ILIKE :q)")
        params["q"] = f"%{search}%"
    if started_filter:
        started_filter.apply(conditions, params, "r.started_at", prefix="started")
    if avg_rating_filter:
        avg_rating_filter.apply(conditions, params, "rs.avg_rating", prefix="avg_rating")
    if resolved_filter:
        resolved_filter.apply(conditions, params, "COALESCE(rs.resolved_count, 0)", prefix="resolved", as_int=True)

    sta_f.apply_status(conditions, _STATUS_SQL)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    if sort is not None:
        order_by = f"{sort.order_by_clause()}, r.id ASC"
    else:
        order_by = "r.started_at DESC NULLS LAST, r.id ASC"

    params.update(paginator.params)

    rows = db.session.execute(
        sa.text(f"""
            WITH run_stats AS (
                SELECT
                    rp.run_id,
                    COUNT(*)                                              AS total_puzzles,
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM training_attempts pa
                        WHERE pa.run_training_item_id = rp.id
                          AND pa.status = 'solved'
                          AND pa.try_number = 1
                    ))                                                    AS first_solved_count,
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM training_attempts pa
                        WHERE pa.run_training_item_id = rp.id
                          AND pa.status != 'in_progress'
                    ))                                                    AS resolved_count,
                    AVG(
                        CASE ti.source_type::text
                            WHEN 'LICHESS_TACTIC'     THEN lt.rating
                            WHEN 'SCRAPED_POSITIONAL' THEN
                                CASE spd.value
                                    WHEN 1 THEN 1500
                                    WHEN 2 THEN 1800
                                    WHEN 3 THEN 2000
                                    WHEN 4 THEN 2200
                                END
                            ELSE NULL
                        END
                    )                                                     AS avg_rating,
                    AVG(la.time_spent_ms)                                AS avg_solve_time_ms,
                    AVG(first_solve.time_spent_ms)                       AS avg_time_solved_ms,
                    AVG(last_failed.time_spent_ms)                       AS avg_time_failed_ms
                FROM run_training_items rp
                JOIN training_items ti ON ti.id = rp.training_item_id
                LEFT JOIN lichess_tactics lt  ON lt.training_item_id = rp.training_item_id
                LEFT JOIN scraped_positional_puzzles spp ON spp.training_item_id = rp.training_item_id
                LEFT JOIN scraped_positional_difficulties spd ON spd.id = spp.difficulty_id
                LEFT JOIN LATERAL (
                    SELECT pa.time_spent_ms
                    FROM training_attempts pa
                    WHERE pa.run_training_item_id = rp.id
                      AND pa.status != 'in_progress'
                    ORDER BY pa.try_number DESC
                    LIMIT 1
                ) la ON true
                LEFT JOIN LATERAL (
                    SELECT pa.time_spent_ms
                    FROM training_attempts pa
                    WHERE pa.run_training_item_id = rp.id
                      AND pa.status = 'solved'
                      AND pa.try_number = 1
                    LIMIT 1
                ) first_solve ON true
                LEFT JOIN LATERAL (
                    SELECT pa.time_spent_ms
                    FROM training_attempts pa
                    WHERE pa.run_training_item_id = rp.id
                      AND pa.status = 'failed'
                    ORDER BY pa.try_number DESC
                    LIMIT 1
                ) last_failed ON true
                GROUP BY rp.run_id
            )
            SELECT
                r.id          AS run_id,
                r.training_id,
                r.run_index,
                r.started_at,
                r.completed_at,
                r.aborted_at,
                u.id          AS user_id,
                u.display_name,
                u.avatar_url,
                s.id          AS schedule_id,
                s.name        AS schedule_name,
                COALESCE(rs.first_solved_count, 0)  AS first_solved_count,
                COALESCE(rs.resolved_count, 0)       AS resolved_count,
                COALESCE(rs.total_puzzles, 0)        AS total_puzzles,
                rs.avg_rating,
                rs.avg_solve_time_ms,
                rs.avg_time_solved_ms,
                rs.avg_time_failed_ms,
                CASE
                    WHEN COALESCE(rs.resolved_count, 0) > 0
                    THEN rs.first_solved_count::float / rs.resolved_count * 100
                    ELSE NULL
                END AS accuracy_pct,
                CASE
                    WHEN COALESCE(rs.resolved_count, 0) > 0
                     AND COALESCE(prev_rs.resolved_count, 0) > 0
                    THEN ROUND(
                        (
                            (rs.first_solved_count::float / rs.resolved_count * 100)
                            - (prev_rs.first_solved_count::float / prev_rs.resolved_count * 100)
                        )::numeric,
                        1
                    )::float
                    ELSE NULL
                END AS delta_accuracy_pct,
                COUNT(*) OVER() AS total_count
            FROM runs r
            JOIN trainings t ON t.id = r.training_id
            JOIN users u     ON u.id = t.user_id
            JOIN schedules s ON s.id = t.schedule_id
            LEFT JOIN run_stats rs ON rs.run_id = r.id
            LEFT JOIN runs prev_r
                ON prev_r.training_id = r.training_id
               AND prev_r.run_index = r.run_index - 1
               AND prev_r.aborted_at IS NULL
            LEFT JOIN run_stats prev_rs ON prev_rs.run_id = prev_r.id
            {where}
            ORDER BY {order_by}
            LIMIT :page_limit OFFSET :page_offset
        """),
        params,
    ).all()

    def _mapper(row: object) -> dict[str, object]:
        if row.aborted_at is not None:  # type: ignore[attr-defined]
            status = "aborted"
        elif row.completed_at is not None:  # type: ignore[attr-defined]
            status = "completed"
        else:
            status = "active"
        accuracy_pct = float(row.accuracy_pct) if row.accuracy_pct is not None else None  # type: ignore[attr-defined]
        if accuracy_pct is not None:
            accuracy_pct = round(accuracy_pct, 1)
        return {
            "runId": int(row.run_id),  # type: ignore[attr-defined]
            "trainingId": int(row.training_id),  # type: ignore[attr-defined]
            "runIndex": int(row.run_index),  # type: ignore[attr-defined]
            "startedAt": row.started_at.isoformat(),  # type: ignore[attr-defined]
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,  # type: ignore[attr-defined]
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,  # type: ignore[attr-defined]
            "status": status,
            "userId": int(row.user_id),  # type: ignore[attr-defined]
            "displayName": row.display_name,  # type: ignore[attr-defined]
            "avatarUrl": row.avatar_url,  # type: ignore[attr-defined]
            "scheduleId": int(row.schedule_id),  # type: ignore[attr-defined]
            "scheduleName": row.schedule_name,  # type: ignore[attr-defined]
            "firstSolvedCount": int(row.first_solved_count),  # type: ignore[attr-defined]
            "resolvedCount": int(row.resolved_count),  # type: ignore[attr-defined]
            "totalPuzzles": int(row.total_puzzles),  # type: ignore[attr-defined]
            "accuracyPct": accuracy_pct,
            "avgRating": float(row.avg_rating) if row.avg_rating is not None else None,  # type: ignore[attr-defined]
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,  # type: ignore[attr-defined]
            "avgTimeSolvedMs": float(row.avg_time_solved_ms) if row.avg_time_solved_ms is not None else None,  # type: ignore[attr-defined]
            "avgTimeFailedMs": float(row.avg_time_failed_ms) if row.avg_time_failed_ms is not None else None,  # type: ignore[attr-defined]
            "deltaAccuracyPct": float(row.delta_accuracy_pct) if row.delta_accuracy_pct is not None else None,  # type: ignore[attr-defined]
        }

    return paginator.paginate(rows, _mapper)


def get_weekly_board(
    user_filter: FilterList | None = None,
    puzzles_filter: RangeFilter | None = None,
    avg_rating_filter: RangeFilter | None = None,
    schedules_filter: SetFilter | None = None,
    search: str | None = None,
    paginator: Paginator | None = None,
    sort: SortParam | None = None,
) -> tuple[list[dict[str, object]], int]:
    if paginator is None:
        paginator = Paginator(page=1, page_size=50)
    usr_f = user_filter or _EMPTY_FILTER

    outer_conditions: list[str] = []
    params: dict[str, object] = {}
    usr_f.apply(outer_conditions, params, "u.id", prefix="usr")
    if search:
        outer_conditions.append("u.display_name ILIKE :q")
        params["q"] = f"%{search}%"
    if puzzles_filter:
        puzzles_filter.apply(outer_conditions, params, "COALESCE(ws.resolved_count, 0)", prefix="puzzles", as_int=True)
    if avg_rating_filter:
        avg_rating_filter.apply(outer_conditions, params, "ws.avg_rating", prefix="avg_rating")
    if schedules_filter:
        schedules_filter.apply(outer_conditions, params, "ws.schedule_ids", prefix="schedules")
    outer_where = ("WHERE " + " AND ".join(outer_conditions)) if outer_conditions else ""

    if sort is not None:
        order_by = f"{sort.order_by_clause()}, u.display_name ASC NULLS LAST"
    else:
        order_by = "COALESCE(ws.resolved_count, 0) DESC NULLS LAST, u.display_name ASC NULLS LAST"

    params.update(paginator.params)

    rows = db.session.execute(
        sa.text(f"""
            WITH weekly_stats AS (
                SELECT
                    t.user_id,
                    COUNT(DISTINCT rp.id) FILTER (WHERE pa.status = 'solved' AND pa.try_number = 1)
                                                AS puzzles_solved,
                    COUNT(DISTINCT rp.id)       AS resolved_count,
                    COUNT(DISTINCT rp.id) FILTER (WHERE ti.source_type::text = 'LICHESS_TACTIC')     AS lichess_tactic_count,
                    COUNT(DISTINCT rp.id) FILTER (WHERE ti.source_type::text = 'SCRAPED_POSITIONAL') AS scraped_positional_count,
                    COUNT(DISTINCT rp.id) FILTER (WHERE ti.source_type::text = 'DECOY')              AS decoy_count,
                    AVG(
                        CASE ti.source_type::text
                            WHEN 'LICHESS_TACTIC'     THEN lt.rating
                            WHEN 'SCRAPED_POSITIONAL' THEN
                                CASE spd.value
                                    WHEN 1 THEN 1500
                                    WHEN 2 THEN 1800
                                    WHEN 3 THEN 2000
                                    WHEN 4 THEN 2200
                                END
                            ELSE NULL
                        END
                    )                           AS avg_rating,
                    AVG(pa.time_spent_ms)       AS avg_solve_time_ms,
                    ARRAY_AGG(DISTINCT s.name ORDER BY s.name)           AS schedule_names,
                    ARRAY_AGG(DISTINCT t.schedule_id ORDER BY t.schedule_id) AS schedule_ids
                FROM training_attempts pa
                JOIN run_training_items rp ON rp.id = pa.run_training_item_id
                JOIN runs r       ON r.id = rp.run_id
                JOIN trainings t  ON t.id = r.training_id
                JOIN schedules s  ON s.id = t.schedule_id
                JOIN training_items ti ON ti.id = rp.training_item_id
                LEFT JOIN lichess_tactics lt  ON lt.training_item_id = rp.training_item_id
                LEFT JOIN scraped_positional_puzzles spp ON spp.training_item_id = rp.training_item_id
                LEFT JOIN scraped_positional_difficulties spd ON spd.id = spp.difficulty_id
                WHERE pa.completed_at >= NOW() - INTERVAL '7 days'
                  AND pa.status != 'in_progress'
                GROUP BY t.user_id
            ),
            active_users AS (
                SELECT DISTINCT t.user_id
                FROM trainings t
                JOIN runs r ON r.training_id = t.id AND r.aborted_at IS NULL
            )
            SELECT
                u.id                                     AS user_id,
                u.display_name,
                u.avatar_url,
                COALESCE(ws.puzzles_solved, 0)                AS puzzles_solved,
                COALESCE(ws.resolved_count, 0)               AS resolved_count,
                COALESCE(ws.lichess_tactic_count, 0)         AS lichess_tactic_count,
                COALESCE(ws.scraped_positional_count, 0)     AS scraped_positional_count,
                COALESCE(ws.decoy_count, 0)                  AS decoy_count,
                ws.avg_rating,
                ws.avg_solve_time_ms,
                COALESCE(ws.schedule_names, ARRAY[]::text[]) AS schedule_names,
                CASE WHEN COALESCE(ws.resolved_count, 0) > 0 THEN ROUND((ws.puzzles_solved::float / ws.resolved_count * 100)::numeric, 1)::float ELSE NULL END AS avg_accuracy_pct,
                CASE WHEN COALESCE(ws.resolved_count, 0) > 0 THEN ROUND((ws.lichess_tactic_count::float / ws.resolved_count * 100)::numeric, 1)::float ELSE NULL END AS lichess_tactic_pct,
                CASE WHEN COALESCE(ws.resolved_count, 0) > 0 THEN ROUND((ws.scraped_positional_count::float / ws.resolved_count * 100)::numeric, 1)::float ELSE NULL END AS scraped_positional_pct,
                CASE WHEN COALESCE(ws.resolved_count, 0) > 0 THEN ROUND((ws.decoy_count::float / ws.resolved_count * 100)::numeric, 1)::float ELSE NULL END AS decoy_pct,
                COUNT(*) OVER() AS total_count
            FROM active_users au
            JOIN users u ON u.id = au.user_id
            LEFT JOIN weekly_stats ws ON ws.user_id = au.user_id
            {outer_where}
            ORDER BY {order_by}
            LIMIT :page_limit OFFSET :page_offset
        """),
        params,
    ).all()

    def _mapper(row: object) -> dict[str, object]:
        return {
            "userId": int(row.user_id),  # type: ignore[attr-defined]
            "displayName": row.display_name,  # type: ignore[attr-defined]
            "avatarUrl": row.avatar_url,  # type: ignore[attr-defined]
            "puzzlesAttempted": int(row.resolved_count),  # type: ignore[attr-defined]
            "lichessTacticPct": float(row.lichess_tactic_pct) if row.lichess_tactic_pct is not None else None,  # type: ignore[attr-defined]
            "scrapedPositionalPct": float(row.scraped_positional_pct) if row.scraped_positional_pct is not None else None,  # type: ignore[attr-defined]
            "decoyPct": float(row.decoy_pct) if row.decoy_pct is not None else None,  # type: ignore[attr-defined]
            "avgRating": float(row.avg_rating) if row.avg_rating is not None else None,  # type: ignore[attr-defined]
            "avgAccuracyPct": float(row.avg_accuracy_pct) if row.avg_accuracy_pct is not None else None,  # type: ignore[attr-defined]
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,  # type: ignore[attr-defined]
            "scheduleNames": list(row.schedule_names) if row.schedule_names else [],  # type: ignore[attr-defined]
        }

    return paginator.paginate(rows, _mapper)
