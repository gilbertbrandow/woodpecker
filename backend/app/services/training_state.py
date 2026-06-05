import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import sqlalchemy as sa

from app.extensions import db
from app.models.run import Run, RunTrainingItem, TrainingAttempt
from app.models.training import Training
from app.services.schedule_config import ScheduleConfig


def end_of_today_utc(tz_str: str) -> datetime:
    tz: ZoneInfo | timezone
    try:
        tz = ZoneInfo(tz_str)
    except ZoneInfoNotFoundError:
        tz = timezone.utc
    now_local = datetime.now(tz)
    eod_local = now_local.replace(hour=23, minute=59, second=59, microsecond=999999)
    return eod_local.astimezone(timezone.utc)


def compute_training_state(
    completed_runs: list[Run],
    active_run: Run | None,
    schedule_cfg: ScheduleConfig,
    training: Training,
    now: datetime,
    tz_str: str,
    active_resolved: int | None = None,
    active_total_items: int | None = None,
) -> dict[str, object]:
    if training.aborted_at is not None:
        return {"state": "aborted"}

    if training.completed_at is not None:
        return {"state": "completed"}

    if active_run is not None:
        run_index = active_run.run_index
        run_def = schedule_cfg.runs[run_index] if run_index < len(schedule_cfg.runs) else None
        target_hours = run_def.target_hours if run_def else 0

        if active_total_items is None:
            active_total_items = db.session.scalar(
                sa.select(sa.func.count()).where(RunTrainingItem.run_id == active_run.id)
            ) or 0

        if active_resolved is None:
            active_resolved = db.session.scalar(
                sa.select(sa.func.count())
                .select_from(RunTrainingItem)
                .where(
                    RunTrainingItem.run_id == active_run.id,
                    sa.exists(
                        sa.select(sa.literal(1))
                        .where(
                            TrainingAttempt.run_training_item_id == RunTrainingItem.id,
                            TrainingAttempt.status != "in_progress",
                        )
                    ),
                    ~sa.exists(
                        sa.select(sa.literal(1))
                        .where(
                            TrainingAttempt.run_training_item_id == RunTrainingItem.id,
                            TrainingAttempt.status == "in_progress",
                        )
                    ),
                )
            ) or 0

        deadline = active_run.started_at + timedelta(hours=target_hours)
        is_overdue = now > deadline

        if is_overdue:
            return {
                "state": "active_run_overdue",
                "runIndex": run_index,
                "runId": active_run.id,
                "runStartedAt": active_run.started_at.isoformat(),
                "runDeadlineAt": deadline.isoformat(),
                "resolvedCount": active_resolved,
                "totalItems": active_total_items,
            }

        window_secs = target_hours * 3600.0
        elapsed_secs = (now - active_run.started_at).total_seconds()
        fraction = elapsed_secs / window_secs if window_secs > 0 else 1.0
        expected_now = math.floor(fraction * active_total_items)
        daily_rate = active_total_items / (target_hours / 24.0) if target_hours > 0 else float(active_total_items)

        if active_resolved > expected_now:
            state = "active_run_ahead"
        elif active_resolved >= expected_now - daily_rate:
            state = "active_run_on_track"
        else:
            state = "active_run_behind"

        eod_utc = end_of_today_utc(tz_str)
        frac_tomorrow = min(1.0, (eod_utc - active_run.started_at).total_seconds() / window_secs) if window_secs > 0 else 1.0
        expected_by_tomorrow = math.ceil(frac_tomorrow * active_total_items)
        puzzles_to_solve_before_tomorrow = max(0, expected_by_tomorrow - active_resolved)

        return {
            "state": state,
            "runIndex": run_index,
            "runId": active_run.id,
            "runStartedAt": active_run.started_at.isoformat(),
            "runDeadlineAt": deadline.isoformat(),
            "resolvedCount": active_resolved,
            "totalItems": active_total_items,
            "expectedResolvedByNow": expected_now,
            "expectedResolvedByTomorrow": expected_by_tomorrow,
            "puzzlesToSolveBeforeTomorrow": puzzles_to_solve_before_tomorrow,
        }

    if len(completed_runs) >= len(schedule_cfg.runs) and len(schedule_cfg.runs) > 0:
        return {"state": "completed"}

    if completed_runs:
        last_run = max(completed_runs, key=lambda r: r.completed_at or datetime.min)
        assert last_run.completed_at is not None
        run_idx = last_run.run_index
        run_def = schedule_cfg.runs[run_idx] if run_idx < len(schedule_cfg.runs) else None
        break_after_hours = run_def.break_after_hours if run_def else 0

        break_ends_at = last_run.completed_at + timedelta(hours=break_after_hours)
        next_run_index = run_idx + 1

        if break_after_hours > 0 and now < break_ends_at:
            remaining_ms = int((break_ends_at - now).total_seconds() * 1000)
            return {
                "state": "scheduled_break",
                "nextRunIndex": next_run_index,
                "breakStartedAt": last_run.completed_at.isoformat(),
                "breakEndsAt": break_ends_at.isoformat(),
                "breakRemainingMs": remaining_ms,
            }

        elapsed_ms = max(0, int((now - break_ends_at).total_seconds() * 1000))
        return {
            "state": "overdue_to_start_next_run",
            "nextRunIndex": next_run_index,
            "breakEndsAt": break_ends_at.isoformat(),
            "elapsedSinceBreakEndMs": elapsed_ms,
        }

    return {
        "state": "not_started",
        "nextRunIndex": 0,
        "totalRuns": len(schedule_cfg.runs),
    }


