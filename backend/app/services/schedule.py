from datetime import datetime, timezone
from typing import cast

import sqlalchemy as sa

from app.extensions import db
from app.models.schedule import Schedule
from app.models.subset import Subset

MAX_RUNS = 20
MAX_REPEATS = 5
VALID_PUZZLE_ORDERS = frozenset({"random", "fixed", "rating_asc", "rating_desc"})


def _validate_config(config: dict[str, object]) -> None:
    runs_raw = config.get("runs")
    if not isinstance(runs_raw, list):
        raise ValueError("config.runs must be a list.")
    if not runs_raw:
        raise ValueError("config.runs must have at least one entry.")
    if len(runs_raw) > MAX_RUNS:
        raise ValueError(f"config.runs must have at most {MAX_RUNS} entries.")
    for i, run_item in enumerate(runs_raw):
        if not isinstance(run_item, dict):
            raise ValueError(f"config.runs[{i}] must be an object.")
        run = cast(dict[str, object], run_item)
        target_days = run.get("target_days")
        break_after = run.get("break_after_days")
        if not isinstance(target_days, int) or target_days < 1:
            raise ValueError(f"config.runs[{i}].target_days must be a positive integer.")
        if not isinstance(break_after, int) or break_after < 0:
            raise ValueError(f"config.runs[{i}].break_after_days must be a non-negative integer.")

    order_raw = config.get("puzzle_order")
    if order_raw not in VALID_PUZZLE_ORDERS:
        raise ValueError(
            f"config.puzzle_order must be one of: {', '.join(sorted(VALID_PUZZLE_ORDERS))}."
        )

    rep_raw = config.get("failed_repetition")
    if not isinstance(rep_raw, dict):
        raise ValueError("config.failed_repetition must be an object.")
    rep = cast(dict[str, object], rep_raw)
    mode = rep.get("mode")
    if mode not in ("none", "queue"):
        raise ValueError("config.failed_repetition.mode must be 'none' or 'queue'.")
    if mode == "queue":
        max_repeats = rep.get("max_repeats")
        if not isinstance(max_repeats, int) or not (1 <= max_repeats <= MAX_REPEATS):
            raise ValueError(
                f"config.failed_repetition.max_repeats must be an integer between 1 and {MAX_REPEATS}."
            )


def compute_total_days(config: dict[str, object]) -> int:
    runs_raw = config.get("runs")
    if not isinstance(runs_raw, list):
        return 0
    total = 0
    for run_item in runs_raw:
        if not isinstance(run_item, dict):
            continue
        run = cast(dict[str, object], run_item)
        target = run.get("target_days")
        break_after = run.get("break_after_days")
        total += (target if isinstance(target, int) else 0) + (
            break_after if isinstance(break_after, int) else 0
        )
    return total


def _get_owned_schedule(schedule_id: int, user_id: int) -> Schedule:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    if schedule.user_id != user_id:
        raise PermissionError("Access denied.")
    return schedule


def _get_accessible_schedule(schedule_id: int, user_id: int) -> Schedule:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    if schedule.status == "draft" and schedule.user_id != user_id:
        raise PermissionError("Access denied.")
    return schedule


def create_schedule(user_id: int, name: str, subset_id: int) -> Schedule:
    name = name.strip()
    if not name:
        raise ValueError("Name is required.")
    subset = db.session.get(Subset, subset_id)
    if subset is None:
        raise LookupError("Subset not found.")
    if subset.status != "locked":
        raise ValueError("Subset must be locked before creating a schedule.")
    schedule = Schedule(user_id=user_id, subset_id=subset_id, name=name, status="draft")
    db.session.add(schedule)
    db.session.commit()
    return schedule


def update_schedule(
    schedule_id: int,
    user_id: int,
    updates: dict[str, object],
) -> Schedule:
    schedule = _get_owned_schedule(schedule_id, user_id)
    if schedule.status == "locked":
        raise PermissionError("Locked schedules cannot be edited.")

    if "name" in updates:
        name_raw = updates["name"]
        if not isinstance(name_raw, str):
            raise ValueError("name must be a string.")
        name = name_raw.strip()
        if not name:
            raise ValueError("name cannot be empty.")
        schedule.name = name

    if "description" in updates:
        desc_raw = updates["description"]
        if desc_raw is not None and not isinstance(desc_raw, str):
            raise ValueError("description must be a string or null.")
        schedule.description = desc_raw if isinstance(desc_raw, str) else None

    if "config" in updates:
        config_raw = updates["config"]
        if config_raw is not None:
            if not isinstance(config_raw, dict):
                raise ValueError("config must be an object.")
            config_dict = cast(dict[str, object], config_raw)
            _validate_config(config_dict)
            schedule.config = config_dict
        else:
            schedule.config = None

    db.session.commit()
    return schedule


def lock_schedule(schedule_id: int, user_id: int) -> Schedule:
    schedule = _get_owned_schedule(schedule_id, user_id)
    if schedule.status == "locked":
        raise ValueError("Already locked.")
    if schedule.config is None:
        raise ValueError("Cannot lock a schedule without a config.")
    runs_raw = schedule.config.get("runs")
    if not isinstance(runs_raw, list) or not runs_raw:
        raise ValueError("Cannot lock a schedule with no runs defined.")
    schedule.status = "locked"
    schedule.locked_at = datetime.now(timezone.utc)
    db.session.commit()
    return schedule


def get_schedule(schedule_id: int, user_id: int) -> Schedule:
    return _get_accessible_schedule(schedule_id, user_id)


def list_schedules(user_id: int) -> list[dict[str, object]]:
    rows = db.session.execute(
        sa.text("""
            SELECT s.id, s.name, s.description, s.status, s.config,
                   s.created_at, s.locked_at, u.lichess_username
            FROM schedules s
            JOIN users u ON u.id = s.user_id
            WHERE s.status = 'locked' OR s.user_id = :uid
            ORDER BY s.created_at DESC
        """),
        {"uid": user_id},
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        config: dict[str, object] = row.config if isinstance(row.config, dict) else {}
        runs_raw = config.get("runs")
        run_count = len(runs_raw) if isinstance(runs_raw, list) else 0
        total_days = compute_total_days(config)
        order_raw = config.get("puzzle_order")
        puzzle_order = order_raw if isinstance(order_raw, str) else None
        result.append({
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "status": row.status,
            "createdBy": row.lichess_username,
            "runCount": run_count,
            "totalDays": total_days,
            "puzzleOrder": puzzle_order,
            "createdAt": row.created_at.isoformat(),
            "lockedAt": row.locked_at.isoformat() if row.locked_at else None,
        })
    return result
