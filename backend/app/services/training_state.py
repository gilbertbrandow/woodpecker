import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import sqlalchemy as sa

from app.extensions import db
from app.models.run import Run, RunTrainingItem
from app.models.training import Training
from app.services.attempt_state import derive_position_status
from app.services.schedule_config import ScheduleConfig


def _end_of_today_utc(tz_str: str) -> datetime:
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
) -> dict[str, object]:
    if training.aborted_at is not None:
        return {"state": "aborted"}

    if training.completed_at is not None:
        return {"state": "completed"}

    if active_run is not None:
        run_index = active_run.run_index
        if run_index < len(schedule_cfg.runs):
            target_hours = schedule_cfg.runs[run_index].target_hours
        else:
            target_hours = 0

        total_items: int = db.session.scalar(
            sa.select(sa.func.count()).where(RunTrainingItem.run_id == active_run.id)
        ) or 0

        total_queue = schedule_cfg.total_queue

        run_items = list(
            db.session.scalars(
                sa.select(RunTrainingItem).where(RunTrainingItem.run_id == active_run.id)
            ).all()
        )

        resolved_count = sum(
            1 for rp in run_items
            if derive_position_status(rp.attempts, total_queue) in ("solved", "solved_with_retries", "failed")
        )

        run_started_at = active_run.started_at
        deadline = run_started_at + timedelta(hours=target_hours)
        is_overdue = now > deadline

        if is_overdue:
            training_items_needed_today = max(0, total_items - resolved_count)
        else:
            eod_utc = _end_of_today_utc(tz_str)
            window_total = timedelta(hours=target_hours).total_seconds()
            if window_total > 0:
                fraction = min(1.0, (eod_utc - run_started_at).total_seconds() / window_total)
            else:
                fraction = 1.0
            expected_by_eod = math.ceil(fraction * total_items)
            training_items_needed_today = max(0, expected_by_eod - resolved_count)

        return {
            "state": "in_progress",
            "runIndex": run_index,
            "totalTrainingItems": total_items,
            "resolvedCount": resolved_count,
            "runStartedAt": run_started_at.isoformat(),
            "runDeadlineAt": deadline.isoformat(),
            "isOverdue": is_overdue,
            "trainingItemsNeededToday": training_items_needed_today,
        }

    if len(completed_runs) >= len(schedule_cfg.runs) and len(schedule_cfg.runs) > 0:
        return {"state": "completed"}

    if completed_runs:
        last_run = max(completed_runs, key=lambda r: r.completed_at)  # type: ignore[arg-type]
        run_idx = last_run.run_index
        if run_idx < len(schedule_cfg.runs):
            break_after_hours = schedule_cfg.runs[run_idx].break_after_hours
        else:
            break_after_hours = 0

        break_ends_at = last_run.completed_at + timedelta(hours=break_after_hours)  # type: ignore[operator]

        if now < break_ends_at:
            remaining_ms = int((break_ends_at - now).total_seconds() * 1000)
            return {
                "state": "on_break",
                "nextRunIndex": run_idx + 1,
                "breakStartedAt": last_run.completed_at.isoformat(),  # type: ignore[union-attr]
                "breakEndsAt": break_ends_at.isoformat(),
                "breakRemainingMs": remaining_ms,
            }
        else:
            elapsed_ms = int((now - break_ends_at).total_seconds() * 1000)
            return {
                "state": "break_elapsed",
                "nextRunIndex": run_idx + 1,
                "breakEndedAt": break_ends_at.isoformat(),
                "elapsedSinceBreakEndMs": elapsed_ms,
            }

    return {
        "state": "not_started",
        "nextRunIndex": 0,
        "totalRuns": len(schedule_cfg.runs),
    }


