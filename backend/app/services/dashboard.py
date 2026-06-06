import math
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from app.extensions import db
from app.models.run import Run, RunTrainingItem, TrainingAttempt
from app.models.schedule import Schedule
from app.models.training import Training
from app.services.schedule_config import ScheduleConfig
from app.services.training import get_training_progress
from app.services.training_state import compute_training_state, end_of_today_utc


# ---------------------------------------------------------------------------
# SQL helper: compute per-run stats in one query for a list of run_ids
# ---------------------------------------------------------------------------

_RUN_STATS_SQL = """
    SELECT
        rp.run_id,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM training_attempts pa
            WHERE pa.run_training_item_id = rp.id
              AND pa.status = 'solved'
              AND pa.try_number = 1
        ))                                                  AS first_solved_count,
        COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM training_attempts pa
            WHERE pa.run_training_item_id = rp.id
              AND pa.status != 'in_progress'
        ))                                                  AS resolved_count,
        COUNT(*)                                            AS total_puzzles,
        AVG(la.time_spent_ms)                              AS avg_solve_time_ms
    FROM run_training_items rp
    LEFT JOIN LATERAL (
        SELECT pa.time_spent_ms
        FROM training_attempts pa
        WHERE pa.run_training_item_id = rp.id
          AND pa.status != 'in_progress'
        ORDER BY pa.try_number DESC
        LIMIT 1
    ) la ON true
    WHERE rp.run_id = ANY(:run_ids)
    GROUP BY rp.run_id
"""


def _batch_run_stats(run_ids: list[int]) -> dict[int, dict]:
    if not run_ids:
        return {}
    rows = db.session.execute(sa.text(_RUN_STATS_SQL), {"run_ids": run_ids}).all()
    out: dict[int, dict] = {}
    for row in rows:
        first = int(row.first_solved_count)
        resolved = int(row.resolved_count)
        total = int(row.total_puzzles)
        accuracy = round(first / resolved * 100, 1) if resolved > 0 else 0.0
        out[int(row.run_id)] = {
            "firstSolvedCount": first,
            "resolvedCount": resolved,
            "totalPuzzles": total,
            "accuracyPct": accuracy,
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,
        }
    return out


# ---------------------------------------------------------------------------
# Training selector loading
# ---------------------------------------------------------------------------

def _load_user_trainings_sorted(user_id: int) -> list[dict]:
    """All trainings for user sorted by latestTouched descending."""
    rows = db.session.execute(
        sa.text("""
            SELECT
                t.id,
                t.schedule_id,
                s.name AS schedule_name,
                s.config,
                t.started_at,
                t.completed_at,
                t.aborted_at,
                CASE
                    WHEN t.aborted_at IS NOT NULL  THEN 'aborted'
                    WHEN t.completed_at IS NOT NULL THEN 'completed'
                    WHEN EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id) THEN 'in_progress'
                    ELSE 'not_started'
                END AS status,
                COALESCE(
                    (SELECT MAX(r.started_at) FROM runs r WHERE r.training_id = t.id),
                    t.started_at
                ) AS latest_touched
            FROM trainings t
            JOIN schedules s ON s.id = t.schedule_id
            WHERE t.user_id = :uid
            ORDER BY latest_touched DESC
        """),
        {"uid": user_id},
    ).all()

    result = []
    for row in rows:
        run_count = 0
        if isinstance(row.config, dict):
            try:
                run_count = len(ScheduleConfig.from_dict(row.config).runs)
            except Exception:
                pass
        result.append({
            "id": int(row.id),
            "scheduleId": int(row.schedule_id),
            "scheduleName": row.schedule_name,
            "config": row.config,
            "status": row.status,
            "runCount": run_count,
            "startedAt": row.started_at,
            "completedAt": row.completed_at,
            "abortedAt": row.aborted_at,
        })
    return result


# ---------------------------------------------------------------------------
# Status card
# ---------------------------------------------------------------------------

def _compute_status_card(
    training: Training,
    selected_run: Run | None,
    all_runs: list[Run],
    schedule_cfg: ScheduleConfig,
    now: datetime,
    tz_str: str,
    all_stats: dict[int, dict] | None = None,
) -> dict:
    # Highest precedence: training terminal states
    if training.completed_at is not None:
        return {"state": "training_completed", "primaryAction": None}

    if training.aborted_at is not None:
        if selected_run is not None and selected_run.completed_at is not None:
            return {"state": "run_completed", "runIndex": selected_run.run_index, "completedAt": selected_run.completed_at.isoformat(), "primaryAction": None}
        return {"state": "training_aborted", "primaryAction": None}

    # Virtual Run 1 (no runs yet)
    if selected_run is None:
        return {
            "state": "not_started",
            "totalRuns": len(schedule_cfg.runs),
            "primaryAction": {"type": "start_run", "trainingId": training.id, "runIndex": 0},
        }

    # Active run — reuse compute_training_state logic
    if selected_run.completed_at is None and selected_run.aborted_at is None:
        run_index = selected_run.run_index
        run_def = schedule_cfg.runs[run_index] if run_index < len(schedule_cfg.runs) else None
        target_hours = run_def.target_hours if run_def else 0

        cached = (all_stats or {}).get(selected_run.id)
        if cached is not None:
            total_items = cached.get("totalPuzzles", 0) or 0
            resolved = cached.get("resolvedCount", 0) or 0
        else:
            total_items = db.session.scalar(
                sa.select(sa.func.count()).where(RunTrainingItem.run_id == selected_run.id)
            ) or 0
            resolved = db.session.scalar(
                sa.select(sa.func.count())
                .select_from(RunTrainingItem)
                .where(
                    RunTrainingItem.run_id == selected_run.id,
                    sa.exists(
                        sa.select(sa.literal(1)).where(
                            TrainingAttempt.run_training_item_id == RunTrainingItem.id,
                            TrainingAttempt.status != "in_progress",
                        )
                    ),
                    ~sa.exists(
                        sa.select(sa.literal(1)).where(
                            TrainingAttempt.run_training_item_id == RunTrainingItem.id,
                            TrainingAttempt.status == "in_progress",
                        )
                    ),
                )
            ) or 0

        deadline = selected_run.started_at + timedelta(hours=target_hours)
        is_overdue = now > deadline
        continue_action: dict = {"type": "continue_run", "runId": selected_run.id}

        if is_overdue:
            return {
                "state": "active_run_overdue",
                "runIndex": run_index,
                "runId": selected_run.id,
                "runStartedAt": selected_run.started_at.isoformat(),
                "runDeadlineAt": deadline.isoformat(),
                "resolvedCount": resolved,
                "totalItems": total_items,
                "primaryAction": continue_action,
            }

        window_secs = target_hours * 3600.0
        elapsed_secs = (now - selected_run.started_at).total_seconds()
        fraction = elapsed_secs / window_secs if window_secs > 0 else 1.0
        expected_now = math.floor(fraction * total_items)
        daily_rate = total_items / (target_hours / 24.0) if target_hours > 0 else float(total_items)

        if resolved > expected_now:
            state = "active_run_ahead"
        elif resolved >= expected_now - daily_rate:
            state = "active_run_on_track"
        else:
            state = "active_run_behind"

        eod_utc = end_of_today_utc(tz_str)
        frac_tomorrow = min(1.0, (eod_utc - selected_run.started_at).total_seconds() / window_secs) if window_secs > 0 else 1.0
        expected_by_tomorrow = math.ceil(frac_tomorrow * total_items)
        puzzles_before_tomorrow = max(0, expected_by_tomorrow - resolved)

        return {
            "state": state,
            "runIndex": run_index,
            "runId": selected_run.id,
            "runStartedAt": selected_run.started_at.isoformat(),
            "runDeadlineAt": deadline.isoformat(),
            "resolvedCount": resolved,
            "totalItems": total_items,
            "expectedResolvedByNow": expected_now,
            "expectedResolvedByTomorrow": expected_by_tomorrow,
            "puzzlesToSolveBeforeTomorrow": puzzles_before_tomorrow,
            "primaryAction": continue_action,
        }

    # Completed run — determine if it's the latest
    non_aborted = [r for r in all_runs if r.aborted_at is None]
    latest_run = max(non_aborted, key=lambda r: r.run_index) if non_aborted else None
    is_latest = latest_run is not None and selected_run.run_index == latest_run.run_index

    assert selected_run.completed_at is not None
    if not is_latest:
        return {"state": "run_completed", "runIndex": selected_run.run_index, "completedAt": selected_run.completed_at.isoformat(), "primaryAction": None}

    # Latest completed run — check break
    run_def = schedule_cfg.runs[selected_run.run_index] if selected_run.run_index < len(schedule_cfg.runs) else None
    break_hours = run_def.break_after_hours if run_def else 0
    next_run_index = selected_run.run_index + 1

    if next_run_index >= len(schedule_cfg.runs):
        # All runs done but training not marked complete yet (edge case)
        return {"state": "run_completed", "runIndex": selected_run.run_index, "completedAt": selected_run.completed_at.isoformat(), "primaryAction": None}

    break_ends_at = selected_run.completed_at + timedelta(hours=break_hours)

    if break_hours > 0 and now < break_ends_at:
        remaining_ms = int((break_ends_at - now).total_seconds() * 1000)
        return {
            "state": "scheduled_break",
            "nextRunIndex": next_run_index,
            "breakEndsAt": break_ends_at.isoformat(),
            "breakRemainingMs": remaining_ms,
            "primaryAction": None,
        }

    elapsed_ms = max(0, int((now - break_ends_at).total_seconds() * 1000))
    return {
        "state": "overdue_to_start_next_run",
        "nextRunIndex": next_run_index,
        "breakEndsAt": break_ends_at.isoformat(),
        "elapsedSinceBreakEndMs": elapsed_ms,
        "primaryAction": {"type": "start_run", "trainingId": training.id, "runIndex": next_run_index},
    }


# ---------------------------------------------------------------------------
# Metric cards + runs accuracy (share a single stat fetch)
# ---------------------------------------------------------------------------

def _compute_metric_cards(
    selected_run: Run | None,
    prev_run: Run | None,
    all_stats: dict[int, dict],
) -> dict:
    if selected_run is None:
        return {
            "accuracy": {"valuePct": None, "deltaPct": None},
            "avgSolveTime": {"valueMs": None, "deltaMs": None},
        }

    sel = all_stats.get(selected_run.id, {"accuracyPct": 0.0, "avgSolveTimeMs": None})
    accuracy_pct: float = sel.get("accuracyPct", 0.0) or 0.0
    avg_ms: float | None = sel.get("avgSolveTimeMs")

    delta_pct: float | None = None
    delta_ms: float | None = None

    if prev_run is not None:
        prev = all_stats.get(prev_run.id, {"accuracyPct": 0.0, "avgSolveTimeMs": None})
        prev_acc: float = prev.get("accuracyPct", 0.0) or 0.0
        delta_pct = round(accuracy_pct - prev_acc, 1)
        prev_avg_ms: float | None = prev.get("avgSolveTimeMs")
        if avg_ms is not None and prev_avg_ms is not None:
            delta_ms = avg_ms - prev_avg_ms

    return {
        "accuracy": {"valuePct": round(accuracy_pct, 1), "deltaPct": delta_pct},
        "avgSolveTime": {
            "valueMs": round(avg_ms) if avg_ms is not None else 0,
            "deltaMs": round(delta_ms) if delta_ms is not None else None,
        },
    }


def _build_runs_accuracy(
    non_aborted_runs: list[Run],
    run_count: int,
    all_stats: dict[int, dict],
) -> list[dict]:
    run_by_index = {r.run_index: r for r in non_aborted_runs}
    result = []
    for i in range(run_count):
        run = run_by_index.get(i)
        if run is None:
            result.append({"runIndex": i, "accuracyPct": None, "inProgress": False, "completed": False})
        else:
            stats = all_stats.get(run.id, {"accuracyPct": 0.0})
            result.append({
                "runIndex": i,
                "accuracyPct": stats.get("accuracyPct", 0.0),
                "inProgress": run.completed_at is None and run.aborted_at is None,
                "completed": run.completed_at is not None,
            })
    return result


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def get_dashboard(
    user_id: int,
    training_id: int | None,
    run_index: int | None,
    tz_str: str,
) -> dict:
    now = datetime.now(timezone.utc)

    all_trainings = _load_user_trainings_sorted(user_id)

    if not all_trainings:
        return {
            "selectedTrainingId": None,
            "selectedRunIndex": None,
            "trainings": [],
            "runSlots": [],
            "statusCard": None,
            "metricCards": None,
            "runsAccuracy": [],
            "progressCard": None,
        }

    # --- Resolve training ---
    resolved = None
    if training_id is not None:
        resolved = next((t for t in all_trainings if t["id"] == training_id), None)

    if resolved is None:
        # Invalid/missing training — reset both params
        resolved = all_trainings[0]
        run_index = None
    elif training_id is None:
        # Only runIndex provided — ignore it (spec: wipe params, use defaults)
        run_index = None

    resolved_training_id = resolved["id"]

    # --- Load schedule config ---
    schedule = db.session.get(Schedule, resolved["scheduleId"])
    if schedule is None or not isinstance(schedule.config, dict):
        return {
            "selectedTrainingId": resolved_training_id,
            "selectedRunIndex": None,
            "trainings": [_training_selector_item(t) for t in all_trainings],
            "runSlots": [],
            "statusCard": None,
            "metricCards": None,
            "runsAccuracy": [],
            "progressCard": None,
        }
    schedule_cfg = ScheduleConfig.from_dict(schedule.config)
    run_count = len(schedule_cfg.runs)

    # --- Load runs ---
    all_runs = list(
        db.session.scalars(
            sa.select(Run)
            .where(Run.training_id == resolved_training_id)
            .order_by(Run.run_index)
        ).all()
    )
    non_aborted_runs = [r for r in all_runs if r.aborted_at is None]
    existing_indices = {r.run_index for r in non_aborted_runs}
    max_index = max(existing_indices) if existing_indices else None

    # Selectable indices: existing runs, plus 0 if no runs at all (virtual Run 1)
    selectable = existing_indices if existing_indices else {0}

    # --- Resolve run_index ---
    if run_index is not None:
        if run_index < 0 or run_index >= run_count or run_index not in selectable:
            run_index = None  # invalid → use default
    if run_index is None:
        run_index = max_index if max_index is not None else 0

    selected_run = next((r for r in non_aborted_runs if r.run_index == run_index), None)
    prev_run = next((r for r in non_aborted_runs if r.run_index == run_index - 1), None) if run_index > 0 else None

    # --- Build run slots ---
    run_slots = []
    for i in range(run_count):
        run = next((r for r in non_aborted_runs if r.run_index == i), None)
        is_virtual = (i == 0 and not existing_indices)
        selectable_slot = run is not None or is_virtual
        run_slots.append({
            "runIndex": i,
            "selectable": selectable_slot,
            "runId": run.id if run is not None else None,
            "status": run.status if run is not None else None,
        })

    # --- Training object for status card ---
    training_obj = Training(
        id=resolved_training_id,
        user_id=user_id,
        schedule_id=resolved["scheduleId"],
        started_at=resolved["startedAt"],
        completed_at=resolved["completedAt"],
        aborted_at=resolved["abortedAt"],
    )

    # --- Batch-fetch stats for all non-aborted runs once ---
    all_stats = _batch_run_stats([r.id for r in non_aborted_runs]) if non_aborted_runs else {}

    # --- Status card ---
    status_card = _compute_status_card(
        training_obj, selected_run, all_runs, schedule_cfg, now, tz_str, all_stats
    )

    # --- Metric cards ---
    metric_cards = _compute_metric_cards(selected_run, prev_run, all_stats)

    # --- Runs accuracy (for chart) ---
    runs_accuracy = _build_runs_accuracy(non_aborted_runs, run_count, all_stats)

    # --- Progress card ---
    try:
        progress_card = get_training_progress(resolved_training_id, user_id)
    except Exception:
        progress_card = None

    return {
        "selectedTrainingId": resolved_training_id,
        "selectedRunIndex": run_index,
        "trainings": [_training_selector_item(t) for t in all_trainings],
        "runSlots": run_slots,
        "statusCard": status_card,
        "metricCards": metric_cards,
        "runsAccuracy": runs_accuracy,
        "progressCard": progress_card,
    }


def _training_selector_item(t: dict) -> dict:
    return {
        "id": t["id"],
        "scheduleName": t["scheduleName"],
        "status": t["status"],
        "runCount": t["runCount"],
    }
