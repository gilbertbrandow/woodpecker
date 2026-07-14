from datetime import date, datetime, timedelta, timezone
from typing import cast

import sqlalchemy as sa

from app.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.table_query import FilterList
from app.extensions import db
from app.models.schedule import Schedule
from app.models.subset import Subset
from app.models.user import User
from app.services.schedule_config import ScheduleConfig

DEFAULT_CONFIG: dict[str, object] = {
    "runs": [
        {"target_hours": 672, "break_after_hours": 168},
        {"target_hours": 336, "break_after_hours": 72},
        {"target_hours": 168, "break_after_hours": 48},
        {"target_hours": 72, "break_after_hours": 24},
        {"target_hours": 24, "break_after_hours": 0},
    ],
    "puzzle_order": "random",
    "failed_repetition": {"mode": "none"},
}


def schedule_to_dict(schedule: Schedule, creator: User) -> dict[str, object]:
    total_hours: int = 0
    if isinstance(schedule.config, dict):
        total_hours = ScheduleConfig.from_dict(schedule.config).total_hours
    return {
        "id": schedule.id,
        "name": schedule.name,
        "description": schedule.description,
        "subsetId": schedule.subset_id,
        "status": schedule.status,
        "config": schedule.config,
        "totalHours": total_hours,
        "createdBy": {"id": creator.id, "displayName": creator.display_name, "avatarUrl": creator.avatar_url},
        "createdAt": schedule.created_at.isoformat(),
        "lockedAt": schedule.locked_at.isoformat() if schedule.locked_at else None,
    }


def _get_owned_schedule(schedule_id: int, user_id: int) -> Schedule:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise NotFoundError("Schedule not found", "The requested schedule does not exist or has been deleted.")
    if schedule.user_id != user_id:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    return schedule


def _get_accessible_schedule(schedule_id: int, user_id: int) -> Schedule:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise NotFoundError("Schedule not found", "The requested schedule does not exist or has been deleted.")
    if schedule.locked_at is None and schedule.user_id != user_id:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    return schedule


def create_schedule(user_id: int, name: str, subset_id: int) -> Schedule:
    name = name.strip()
    if not name:
        raise ValidationError("Name required", "Please provide a name for the schedule.")
    subset = db.session.get(Subset, subset_id)
    if subset is None:
        raise NotFoundError("Subset not found", "The requested subset does not exist or has been deleted.")
    if subset.locked_at is None:
        raise ValidationError("Subset not ready", "The subset must be locked before you can create a schedule from it.")
    schedule = Schedule(user_id=user_id, subset_id=subset_id, name=name, config=DEFAULT_CONFIG)
    db.session.add(schedule)
    db.session.commit()
    return schedule


def update_schedule(
    schedule_id: int,
    user_id: int,
    updates: dict[str, object],
) -> Schedule:
    schedule = _get_owned_schedule(schedule_id, user_id)
    if schedule.locked_at is not None:
        raise ConflictError("Schedule is locked", "This schedule has been locked and can no longer be edited.")

    if "name" in updates:
        name_raw = updates["name"]
        if not isinstance(name_raw, str):
            raise ValidationError("Invalid name", "The name must be a text value.")
        name = name_raw.strip()
        if not name:
            raise ValidationError("Name required", "The name cannot be blank.")
        schedule.name = name

    if "description" in updates:
        desc_raw = updates["description"]
        if desc_raw is not None and not isinstance(desc_raw, str):
            raise ValidationError("Invalid description", "The description must be a text value or left empty.")
        schedule.description = desc_raw if isinstance(desc_raw, str) else None

    if "config" in updates:
        config_raw = updates["config"]
        if config_raw is not None:
            if not isinstance(config_raw, dict):
                raise ValidationError("Invalid configuration", "The configuration must be a valid object.")
            ScheduleConfig.from_dict(cast(dict[str, object], config_raw))
            schedule.config = cast(dict[str, object], config_raw)
        else:
            schedule.config = None

    db.session.commit()
    return schedule


def lock_schedule(schedule_id: int, user_id: int) -> Schedule:
    schedule = _get_owned_schedule(schedule_id, user_id)
    if schedule.locked_at is not None:
        raise ConflictError("Already locked", "This schedule is already locked.")
    if schedule.config is None:
        raise ValidationError("Configuration required", "A schedule must have a configuration set before it can be locked.")
    ScheduleConfig.from_dict(schedule.config)
    schedule.locked_at = datetime.now(timezone.utc)
    db.session.commit()
    return schedule


def delete_schedule(schedule_id: int, user_id: int) -> None:
    schedule = _get_owned_schedule(schedule_id, user_id)
    db.session.delete(schedule)
    db.session.commit()


def suggest_schedules(limit: int = 8) -> list[dict[str, object]]:
    rows = db.session.scalars(
        sa.select(Schedule).order_by(Schedule.created_at.desc()).limit(limit)
    ).all()
    return [{"id": s.id, "name": s.name, "status": s.status} for s in rows]


def search_schedules(q: str, limit: int = 10) -> list[dict[str, object]]:
    rows = db.session.scalars(
        sa.select(Schedule)
        .where(Schedule.name.ilike(f"%{q}%"))
        .order_by(Schedule.name)
        .limit(limit)
    ).all()
    return [{"id": s.id, "name": s.name, "status": s.status} for s in rows]


def get_schedule(schedule_id: int, user_id: int) -> Schedule:
    return _get_accessible_schedule(schedule_id, user_id)


def get_schedule_insights(schedule_id: int, user_id: int) -> list[dict[str, object]]:
    schedule = _get_accessible_schedule(schedule_id, user_id)
    subset = db.session.get(Subset, schedule.subset_id)
    if subset is None:
        return []

    puzzle_count = (
        subset.locked_puzzle_count
        if subset.locked_puzzle_count is not None
        else subset.puzzle_count
    )
    if not puzzle_count or not isinstance(schedule.config, dict):
        return []

    schedule_cfg = ScheduleConfig.from_dict(schedule.config)
    result: list[dict[str, object]] = []
    current = date.today()

    for run_def in schedule_cfg.runs:
        run_days = max(1, round(run_def.target_hours / 24))
        puzzles_per_day = round(puzzle_count / run_days, 1)

        for _ in range(run_days):
            result.append({"date": current.isoformat(), "puzzlesPerDay": puzzles_per_day})
            current += timedelta(days=1)

        break_days = round(run_def.break_after_hours / 24)
        for _ in range(break_days):
            result.append({"date": current.isoformat(), "puzzlesPerDay": 0})
            current += timedelta(days=1)

    return result


def list_schedules(
    user_id: int,
    subset_id: int | None = None,
    locked_only: bool = False,
    statuses: list[str] | None = None,
    statuses_op: str = 'is',
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    user_ids: FilterList | None = None,
) -> dict[str, object]:
    if locked_only:
        access_clause = "s.locked_at IS NOT NULL"
    else:
        access_clause = "(s.locked_at IS NOT NULL OR s.user_id = :uid)"

    params: dict[str, object] = {"uid": user_id}
    conditions: list[str] = [access_clause]

    if subset_id is not None:
        conditions.append("s.subset_id = :subset_id")
        params["subset_id"] = subset_id
    if search:
        conditions.append("s.name ILIKE :search")
        params["search"] = f"%{search}%"
    if user_ids is not None:
        user_ids.apply(conditions, params, "s.user_id", prefix="uid")
    if statuses and not locked_only:
        status_parts: list[str] = []
        if "locked" in statuses:
            status_parts.append("s.locked_at IS NOT NULL")
        if "draft" in statuses:
            status_parts.append("s.locked_at IS NULL")
        if status_parts:
            inner = ' OR '.join(status_parts)
            if statuses_op == 'is_not':
                conditions.append(f"NOT ({inner})")
            else:
                conditions.append(f"({inner})")

    where_sql = "WHERE " + " AND ".join(conditions)
    base_sql = f"""
        FROM schedules s
        JOIN users u ON u.id = s.user_id
        JOIN subsets sub ON sub.id = s.subset_id
        {where_sql}
    """

    if locked_only:
        total: int | None = None
        limit_clause = ""
    else:
        total = int(db.session.execute(sa.text(f"SELECT COUNT(*) {base_sql}"), params).scalar_one())
        offset = (page - 1) * page_size
        limit_clause = f"LIMIT {page_size} OFFSET {offset}"

    rows = db.session.execute(
        sa.text(f"""
            SELECT s.id, s.name, s.description, s.config,
                   s.created_at, s.locked_at, s.subset_id,
                   u.id AS user_id, u.display_name, u.avatar_url,
                   sub.name AS subset_name
            {base_sql}
            ORDER BY s.created_at DESC
            {limit_clause}
        """),
        params,
    ).all()

    items: list[dict[str, object]] = []
    for row in rows:
        if isinstance(row.config, dict):
            schedule_cfg = ScheduleConfig.from_dict(row.config)
            run_count = len(schedule_cfg.runs)
            total_hours = schedule_cfg.total_hours
            puzzle_order: str | None = schedule_cfg.puzzle_order
        else:
            run_count = 0
            total_hours = 0
            puzzle_order = None
        items.append({
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "status": "locked" if row.locked_at is not None else "draft",
            "createdBy": {"id": int(row.user_id), "displayName": row.display_name, "avatarUrl": row.avatar_url},
            "subsetId": row.subset_id,
            "subsetName": row.subset_name,
            "runCount": run_count,
            "totalHours": total_hours,
            "puzzleOrder": puzzle_order,
            "createdAt": row.created_at.isoformat(),
            "lockedAt": row.locked_at.isoformat() if row.locked_at else None,
        })

    return {"items": items, "total": total if total is not None else len(items)}
