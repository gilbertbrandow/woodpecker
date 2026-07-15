from __future__ import annotations

import sqlalchemy as sa

from app.extensions import db
from app.table_query import FilterList, RangeFilter, SetFilter

_EMPTY_FILTER = FilterList(op='is')

_STATUS_SQL = {
    'active':    'r.completed_at IS NULL AND r.aborted_at IS NULL',
    'completed': 'r.completed_at IS NOT NULL AND r.aborted_at IS NULL',
    'aborted':   'r.aborted_at IS NOT NULL',
}


def get_run_board(
    schedule_filter: FilterList | None = None,
    user_filter: FilterList | None = None,
    status_filter: FilterList | None = None,
    run_index: int | None = None,
    exclude_aborted: bool = False,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, object]], int]:
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

    sta_f.apply_status(conditions, _STATUS_SQL)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

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
                     AND COALESCE(prev_rs.resolved_count, 0) > 0
                    THEN ROUND(
                        (
                            (rs.first_solved_count::float / rs.resolved_count * 100)
                            - (prev_rs.first_solved_count::float / prev_rs.resolved_count * 100)
                        )::numeric,
                        1
                    )::float
                    ELSE NULL
                END AS delta_accuracy_pct
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
            ORDER BY r.started_at DESC
        """),
        params,
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        first_solved = int(row.first_solved_count)
        resolved = int(row.resolved_count)
        accuracy_pct: float | None = (
            round(first_solved / resolved * 100, 1) if resolved > 0 else None
        )
        if row.aborted_at is not None:
            status = "aborted"
        elif row.completed_at is not None:
            status = "completed"
        else:
            status = "active"
        result.append({
            "runId": int(row.run_id),
            "trainingId": int(row.training_id),
            "runIndex": int(row.run_index),
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
            "status": status,
            "userId": int(row.user_id),
            "displayName": row.display_name,
            "avatarUrl": row.avatar_url,
            "scheduleId": int(row.schedule_id),
            "scheduleName": row.schedule_name,
            "firstSolvedCount": first_solved,
            "resolvedCount": resolved,
            "totalPuzzles": int(row.total_puzzles),
            "accuracyPct": accuracy_pct,
            "avgRating": float(row.avg_rating) if row.avg_rating is not None else None,
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,
            "avgTimeSolvedMs": float(row.avg_time_solved_ms) if row.avg_time_solved_ms is not None else None,
            "avgTimeFailedMs": float(row.avg_time_failed_ms) if row.avg_time_failed_ms is not None else None,
            "deltaAccuracyPct": float(row.delta_accuracy_pct) if row.delta_accuracy_pct is not None else None,
        })

    total = len(result)
    offset = (page - 1) * page_size
    return result[offset:offset + page_size], total


def get_weekly_board(
    user_filter: FilterList | None = None,
    puzzles_filter: RangeFilter | None = None,
    avg_rating_filter: RangeFilter | None = None,
    schedules_filter: SetFilter | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict[str, object]], int]:
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
                COALESCE(ws.schedule_names, ARRAY[]::text[]) AS schedule_names
            FROM active_users au
            JOIN users u ON u.id = au.user_id
            LEFT JOIN weekly_stats ws ON ws.user_id = au.user_id
            {outer_where}
            ORDER BY COALESCE(ws.resolved_count, 0) DESC, u.display_name
        """),
        params,
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        puzzles_solved = int(row.puzzles_solved)
        resolved = int(row.resolved_count)
        accuracy_pct: float | None = (
            round(puzzles_solved / resolved * 100, 1) if resolved > 0 else None
        )
        lichess_tactic_pct: float | None = (
            round(int(row.lichess_tactic_count) / resolved * 100, 1) if resolved > 0 else None
        )
        scraped_positional_pct: float | None = (
            round(int(row.scraped_positional_count) / resolved * 100, 1) if resolved > 0 else None
        )
        decoy_pct: float | None = (
            round(int(row.decoy_count) / resolved * 100, 1) if resolved > 0 else None
        )
        result.append({
            "userId": int(row.user_id),
            "displayName": row.display_name,
            "avatarUrl": row.avatar_url,
            "puzzlesAttempted": resolved,
            "lichessTacticPct": lichess_tactic_pct,
            "scrapedPositionalPct": scraped_positional_pct,
            "decoyPct": decoy_pct,
            "avgRating": float(row.avg_rating) if row.avg_rating is not None else None,
            "avgAccuracyPct": accuracy_pct,
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,
            "scheduleNames": list(row.schedule_names) if row.schedule_names else [],
        })

    total = len(result)
    offset = (page - 1) * page_size
    return result[offset:offset + page_size], total
