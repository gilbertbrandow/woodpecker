import sqlalchemy as sa

from app.extensions import db


def get_leaderboard_runs(schedule_id: int | None = None) -> list[dict[str, object]]:
    where = "WHERE t.schedule_id = :sid" if schedule_id is not None else ""
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
                    AVG(la.time_spent_ms)                                AS avg_solve_time_ms
                FROM run_training_items rp
                LEFT JOIN LATERAL (
                    SELECT pa.time_spent_ms
                    FROM training_attempts pa
                    WHERE pa.run_training_item_id = rp.id
                      AND pa.status != 'in_progress'
                    ORDER BY pa.try_number DESC
                    LIMIT 1
                ) la ON true
                GROUP BY rp.run_id
            )
            SELECT
                r.id          AS run_id,
                r.training_id,
                r.run_index,
                r.started_at,
                r.completed_at,
                r.aborted_at,
                u.display_name,
                u.avatar_url,
                s.id          AS schedule_id,
                s.name        AS schedule_name,
                COALESCE(rs.first_solved_count, 0) AS first_solved_count,
                COALESCE(rs.resolved_count, 0)     AS resolved_count,
                COALESCE(rs.total_puzzles, 0)      AS total_puzzles,
                rs.avg_solve_time_ms
            FROM runs r
            JOIN trainings t ON t.id = r.training_id
            JOIN users u     ON u.id = t.user_id
            JOIN schedules s ON s.id = t.schedule_id
            LEFT JOIN run_stats rs ON rs.run_id = r.id
            {where}
            ORDER BY r.started_at DESC
        """),
        {"sid": schedule_id} if schedule_id is not None else {},
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
            "displayName": row.display_name,
            "avatarUrl": row.avatar_url,
            "scheduleId": int(row.schedule_id),
            "scheduleName": row.schedule_name,
            "firstSolvedCount": first_solved,
            "resolvedCount": resolved,
            "totalPuzzles": int(row.total_puzzles),
            "accuracyPct": accuracy_pct,
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,
        })
    return result
