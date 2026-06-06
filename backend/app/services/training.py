from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.orm import aliased

from app.extensions import db
from app.models.run import TrainingAttempt, Run, RunTrainingItem
from app.models.schedule import Schedule
from app.models.training import Training
from app.models.subset import Subset
from app.models.user import User
from app.exceptions import ConflictError, ValidationError, NotFoundError, ForbiddenError
from app.services.schedule_config import ScheduleConfig, RunDefinition
from app.services.training_state import compute_training_state


def _get_owned_training(training_id: int, user_id: int) -> Training:
    training = db.session.get(Training, training_id)
    if training is None:
        raise NotFoundError("Training not found", "The requested training does not exist.")
    if training.user_id != user_id:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    return training


def training_full_dict(training: Training) -> dict[str, object]:
    creator_alias = aliased(User)
    owner_alias = aliased(User)
    row = db.session.execute(
        sa.select(Schedule, Subset, creator_alias, owner_alias)
        .join(Subset, Schedule.subset_id == Subset.id)
        .join(creator_alias, Schedule.user_id == creator_alias.id)
        .join(owner_alias, owner_alias.id == training.user_id)
        .where(Schedule.id == training.schedule_id)
    ).first()
    if row is None:
        raise NotFoundError("Schedule not found", "The requested schedule does not exist or has been deleted.")
    schedule, subset, creator, owner = row

    if not isinstance(schedule.config, dict):
        raise NotFoundError("Schedule not configured", "This schedule does not have a configuration set.")
    schedule_cfg = ScheduleConfig.from_dict(schedule.config)
    run_count = len(schedule_cfg.runs)
    puzzle_order = schedule_cfg.puzzle_order
    total_hours = schedule_cfg.total_hours

    puzzle_count = (
        subset.locked_puzzle_count
        if subset.locked_puzzle_count is not None
        else subset.puzzle_count
    ) or 0

    runs = db.session.scalars(
        sa.select(Run)
        .where(Run.training_id == training.id)
        .order_by(Run.run_index)
    ).all()
    run_targets: list[dict[str, object]] = [
        {
            "runIndex": r.run_index,
            "targetAccuracy": r.target_accuracy,
            "targetSolveSeconds": r.target_solve_seconds,
        }
        for r in runs
        if r.target_accuracy is not None or r.target_solve_seconds is not None
    ]

    if training.aborted_at is not None:
        status = "aborted"
    elif training.completed_at is not None:
        status = "completed"
    else:
        status = "in_progress" if runs else "not_started"

    return {
        "id": training.id,
        "scheduleId": training.schedule_id,
        "status": status,
        "startedAt": training.started_at.isoformat(),
        "completedAt": training.completed_at.isoformat() if training.completed_at else None,
        "abortedAt": training.aborted_at.isoformat() if training.aborted_at else None,
        "ownerId": owner.id,
        "ownerDisplayName": owner.display_name,
        "ownerAvatarUrl": owner.avatar_url,
        "runTargets": run_targets,
        "schedule": {
            "id": schedule.id,
            "name": schedule.name,
            "description": schedule.description,
            "status": schedule.status,
            "totalHours": total_hours,
            "runCount": run_count,
            "runs": [{"target_hours": r.target_hours, "break_after_hours": r.break_after_hours} for r in schedule_cfg.runs],
            "puzzleOrder": puzzle_order,
            "createdBy": {
                "displayName": creator.display_name,
                "avatarUrl": creator.avatar_url,
            },
            "subset": {
                "id": subset.id,
                "name": subset.name,
                "puzzleCount": puzzle_count,
            },
        },
    }


def get_cross_run_item_refs(
    training_id: int,
    training_item_id: int,
    user_id: int,
) -> list[dict[str, object]]:
    _get_owned_training(training_id, user_id)

    rows = db.session.execute(
        sa.select(
            RunTrainingItem.id.label("run_training_item_id"),
            Run.id.label("run_id"),
            Run.run_index,
            sa.exists()
            .where(TrainingAttempt.run_training_item_id == RunTrainingItem.id)
            .label("has_attempts"),
        )
        .join(Run, Run.id == RunTrainingItem.run_id)
        .where(
            Run.training_id == training_id,
            RunTrainingItem.training_item_id == training_item_id,
        )
        .order_by(Run.run_index)
    ).all()

    return [
        {
            "runId": int(row.run_id),
            "runIndex": int(row.run_index),
            "runTrainingItemId": int(row.run_training_item_id),
            "hasAttempts": bool(row.has_attempts),
        }
        for row in rows
    ]


def create_training(user_id: int, schedule_id: int) -> Training:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise NotFoundError("Schedule not found", "The requested schedule does not exist or has been deleted.")
    if schedule.locked_at is None:
        raise ValidationError("Schedule not ready", "The schedule must be locked before you can enrol in it.")

    existing = db.session.scalar(
        sa.select(Training).where(
            Training.schedule_id == schedule_id,
            Training.user_id == user_id,
            Training.aborted_at.is_(None),
            Training.completed_at.is_(None),
        )
    )
    if existing is not None:
        raise ConflictError("Already enrolled", "You are already enrolled in this schedule.")

    training = Training(
        user_id=user_id,
        schedule_id=schedule_id,
    )
    db.session.add(training)
    db.session.commit()
    return training


def get_training(training_id: int) -> Training:
    training = db.session.get(Training, training_id)
    if training is None:
        raise NotFoundError("Training not found", "The requested training does not exist.")
    return training


def list_my_trainings(user_id: int, tz_str: str = "UTC") -> list[dict[str, object]]:
    rows = db.session.execute(
        sa.text("""
            SELECT t.id, t.schedule_id,
                   t.started_at, t.completed_at, t.aborted_at,
                   s.name AS schedule_name, s.subset_id, s.config,
                   CASE
                     WHEN t.aborted_at IS NOT NULL THEN 'aborted'
                     WHEN t.completed_at IS NOT NULL THEN 'completed'
                     WHEN EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id) THEN 'in_progress'
                     ELSE 'not_started'
                   END AS status,
                   (
                       SELECT COUNT(*)
                       FROM subset_training_items sp
                       WHERE sp.subset_id = s.subset_id
                   ) AS subset_puzzle_count,
                   (
                       SELECT COUNT(rp.id)
                       FROM runs r
                       JOIN run_training_items rp ON rp.run_id = r.id
                       WHERE r.training_id = t.id
                         AND EXISTS (
                             SELECT 1 FROM training_attempts pa
                             WHERE pa.run_training_item_id = rp.id
                         )
                         AND NOT EXISTS (
                             SELECT 1 FROM training_attempts pa
                             WHERE pa.run_training_item_id = rp.id
                               AND pa.status = 'in_progress'
                         )
                   ) AS completed_puzzles
            FROM trainings t
            JOIN schedules s ON s.id = t.schedule_id
            WHERE t.user_id = :uid
            ORDER BY t.started_at DESC
        """),
        {"uid": user_id},
    ).all()

    now = datetime.now(timezone.utc)
    result: list[dict[str, object]] = []
    for row in rows:
        schedule_cfg: ScheduleConfig | None = None
        total_runs = 0
        if isinstance(row.config, dict):
            schedule_cfg = ScheduleConfig.from_dict(row.config)
            total_runs = len(schedule_cfg.runs)

        training_obj = Training(
            id=row.id,
            user_id=user_id,
            schedule_id=row.schedule_id,
            started_at=row.started_at,
            completed_at=row.completed_at,
            aborted_at=row.aborted_at,
        )

        training_state: dict[str, object] = {"state": "not_started", "nextRunIndex": 0, "totalRuns": total_runs}
        if schedule_cfg is not None:
            runs_for_training = list(
                db.session.scalars(
                    sa.select(Run).where(Run.training_id == row.id)
                ).all()
            )
            completed_runs = [r for r in runs_for_training if r.completed_at is not None and r.aborted_at is None]
            active_run = next(
                (r for r in runs_for_training if r.completed_at is None and r.aborted_at is None),
                None,
            )
            training_state = compute_training_state(
                completed_runs=completed_runs,
                active_run=active_run,
                schedule_cfg=schedule_cfg,
                training=training_obj,
                now=now,
                tz_str=tz_str,
            )

        result.append({
            "id": row.id,
            "scheduleId": row.schedule_id,
            "scheduleName": row.schedule_name,
            "subsetId": row.subset_id,
            "status": row.status,
            "totalRuns": total_runs,
            "completedPuzzles": row.completed_puzzles,
            "totalPuzzles": row.subset_puzzle_count * total_runs,
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
            "trainingState": training_state,
        })
    return result


def set_run_target(
    training_id: int,
    user_id: int,
    run_index: int,
    target_accuracy: float | None,
    target_solve_seconds: int | None,
) -> Run:
    _get_owned_training(training_id, user_id)

    if target_accuracy is not None and not (0.0 <= target_accuracy <= 100.0):
        raise ValidationError("Invalid target accuracy", "The target accuracy must be between 0 and 100.")
    if target_solve_seconds is not None and target_solve_seconds < 1:
        raise ValidationError("Invalid solve time", "The target solve time must be at least 1 second.")

    run = db.session.scalar(
        sa.select(Run).where(
            Run.training_id == training_id,
            Run.run_index == run_index,
        )
    )
    if run is None:
        raise NotFoundError("Run not found", "The requested run does not exist.")
    run.target_accuracy = target_accuracy
    run.target_solve_seconds = target_solve_seconds
    db.session.commit()
    return run


def abort_training(training_id: int, user_id: int) -> Training:
    training = _get_owned_training(training_id, user_id)
    if training.completed_at is not None or training.aborted_at is not None:
        raise ConflictError("Training already ended", "This training has already been completed or aborted.")
    now = datetime.now(timezone.utc)
    training.aborted_at = now
    active_run = db.session.scalar(
        sa.select(Run).where(
            Run.training_id == training.id,
            Run.completed_at.is_(None),
            Run.aborted_at.is_(None),
        )
    )
    if active_run is not None:
        active_run.aborted_at = now
    db.session.commit()
    return training


# Statuses that can be filtered purely in SQL (mapped to WHERE clause fragments)
_SQL_FILTERABLE: dict[str, str] = {
    "not_started": (
        "t.aborted_at IS NULL AND t.completed_at IS NULL"
        " AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id)"
    ),
    "completed": "t.aborted_at IS NULL AND t.completed_at IS NOT NULL",
    "aborted": "t.aborted_at IS NOT NULL",
}

# SQL pre-filter for states that require Python computation to determine
_IN_PROGRESS_SQL = (
    "t.aborted_at IS NULL AND t.completed_at IS NULL"
    " AND EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id)"
)

# Granular states that require computing trainingState in Python
_COMPUTED_STATES = frozenset({
    "active_run_overdue",
    "active_run_ahead",
    "active_run_on_track",
    "active_run_behind",
    "scheduled_break",
    "overdue_to_start_next_run",
})


def list_all_trainings(
    schedule_id: int | None = None,
    user_ids: list[int] | None = None,
    statuses: list[str] | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    tz_str: str = "UTC",
) -> dict[str, object]:
    conditions = []
    params: dict[str, object] = {}

    if schedule_id is not None:
        conditions.append("t.schedule_id = :sid")
        params["sid"] = schedule_id

    if user_ids:
        placeholders = ", ".join(f":uid{i}" for i in range(len(user_ids)))
        conditions.append(f"t.user_id IN ({placeholders})")
        for i, uid in enumerate(user_ids):
            params[f"uid{i}"] = uid

    # Separate SQL-filterable statuses from computed ones
    valid_sql_statuses = [s for s in (statuses or []) if s in _SQL_FILTERABLE]
    has_computed_filter = statuses is not None and any(s in _COMPUTED_STATES for s in statuses)

    if valid_sql_statuses or has_computed_filter:
        parts = [f"({_SQL_FILTERABLE[s]})" for s in valid_sql_statuses]
        if has_computed_filter:
            parts.append(f"({_IN_PROGRESS_SQL})")
        conditions.append("(" + " OR ".join(parts) + ")")

    if search:
        conditions.append("s.name ILIKE :search")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # When computed states are in the filter, fetch all matching rows and paginate in Python
    # (resolved counts need Python computation; SQL pagination would produce wrong totals)
    needs_python_pagination = has_computed_filter

    select_sql = f"""
        SELECT t.id, t.schedule_id, t.user_id,
               t.started_at, t.completed_at, t.aborted_at,
               s.name AS schedule_name, s.subset_id, s.config,
               u.display_name, u.avatar_url,
               CASE
                 WHEN t.aborted_at IS NOT NULL THEN 'aborted'
                 WHEN t.completed_at IS NOT NULL THEN 'completed'
                 WHEN EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id) THEN 'in_progress'
                 ELSE 'not_started'
               END AS status,
               (
                   SELECT COUNT(*)
                   FROM subset_training_items sp
                   WHERE sp.subset_id = s.subset_id
               ) AS subset_puzzle_count,
               (
                   SELECT COUNT(rp.id)
                   FROM runs r
                   JOIN run_training_items rp ON rp.run_id = r.id
                   WHERE r.training_id = t.id
                     AND EXISTS (
                         SELECT 1 FROM training_attempts pa
                         WHERE pa.run_training_item_id = rp.id
                     )
                     AND NOT EXISTS (
                         SELECT 1 FROM training_attempts pa
                         WHERE pa.run_training_item_id = rp.id
                           AND pa.status = 'in_progress'
                     )
               ) AS completed_puzzles
        FROM trainings t
        JOIN schedules s ON s.id = t.schedule_id
        JOIN users u ON u.id = t.user_id
        {where}
        ORDER BY t.started_at DESC
    """

    if needs_python_pagination:
        rows = db.session.execute(sa.text(select_sql), params).all()
        total = 0  # computed after Python filter below
    else:
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        rows = db.session.execute(sa.text(select_sql + " LIMIT :limit OFFSET :offset"), params).all()
        total = db.session.scalar(
            sa.text(f"""
                SELECT COUNT(*)
                FROM trainings t
                JOIN schedules s ON s.id = t.schedule_id
                JOIN users u ON u.id = t.user_id
                {where}
            """),
            {k: v for k, v in params.items() if k not in ("limit", "offset")},
        ) or 0

    now = datetime.now(timezone.utc)

    # Batch-fetch all runs for the page in one query.
    training_ids = [row.id for row in rows]
    runs_by_training: dict[int, list[Run]] = {tid: [] for tid in training_ids}
    if training_ids:
        for run in db.session.scalars(
            sa.select(Run).where(Run.training_id.in_(training_ids))
        ).all():
            runs_by_training[run.training_id].append(run)

    # Identify the active run per training, then batch-fetch resolved/total
    # item counts for those runs in two queries instead of one per training.
    active_run_by_training: dict[int, Run | None] = {}
    active_run_ids: list[int] = []
    for tid, t_runs in runs_by_training.items():
        active = next(
            (r for r in t_runs if r.completed_at is None and r.aborted_at is None),
            None,
        )
        active_run_by_training[tid] = active
        if active is not None:
            active_run_ids.append(active.id)

    total_by_run: dict[int, int] = {}
    resolved_by_run: dict[int, int] = {}
    if active_run_ids:
        for r in db.session.execute(
            sa.select(RunTrainingItem.run_id, sa.func.count().label("total"))
            .where(RunTrainingItem.run_id.in_(active_run_ids))
            .group_by(RunTrainingItem.run_id)
        ).all():
            total_by_run[r.run_id] = r.total

        for r in db.session.execute(
            sa.select(RunTrainingItem.run_id, sa.func.count().label("resolved"))
            .where(
                RunTrainingItem.run_id.in_(active_run_ids),
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
            .group_by(RunTrainingItem.run_id)
        ).all():
            resolved_by_run[r.run_id] = r.resolved

    items: list[dict[str, object]] = []
    for row in rows:
        schedule_cfg: ScheduleConfig | None = None
        total_runs = 0
        if isinstance(row.config, dict):
            schedule_cfg = ScheduleConfig.from_dict(row.config)
            total_runs = len(schedule_cfg.runs)

        training_state: dict[str, object] = {"state": "not_started", "nextRunIndex": 0, "totalRuns": total_runs}
        if schedule_cfg is not None:
            training_obj = Training(
                id=row.id,
                user_id=row.user_id,
                schedule_id=row.schedule_id,
                started_at=row.started_at,
                completed_at=row.completed_at,
                aborted_at=row.aborted_at,
            )
            t_runs = runs_by_training.get(row.id, [])
            completed_runs = [r for r in t_runs if r.completed_at is not None and r.aborted_at is None]
            active_run = active_run_by_training.get(row.id)
            training_state = compute_training_state(
                completed_runs=completed_runs,
                active_run=active_run,
                schedule_cfg=schedule_cfg,
                training=training_obj,
                now=now,
                tz_str=tz_str,
                active_resolved=resolved_by_run.get(active_run.id, 0) if active_run is not None else None,
                active_total_items=total_by_run.get(active_run.id, 0) if active_run is not None else None,
            )

        items.append({
            "id": row.id,
            "scheduleId": row.schedule_id,
            "scheduleName": row.schedule_name,
            "subsetId": row.subset_id,
            "status": row.status,
            "totalRuns": total_runs,
            "completedPuzzles": row.completed_puzzles,
            "totalPuzzles": row.subset_puzzle_count * total_runs,
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
            "trainingState": training_state,
            "user": {
                "id": row.user_id,
                "displayName": row.display_name,
                "avatarUrl": row.avatar_url,
            },
        })

    if needs_python_pagination:
        requested_states = set(statuses or [])
        items = [i for i in items if i["trainingState"]["state"] in requested_states]  # type: ignore[index]
        total = len(items)
        start = (page - 1) * page_size
        items = items[start : start + page_size]

    return {"items": items, "total": total}


def training_status(training: Training) -> str:
    if training.aborted_at is not None:
        return "aborted"
    if training.completed_at is not None:
        return "completed"
    run_count = db.session.scalar(
        sa.select(sa.func.count()).where(Run.training_id == training.id)
    ) or 0
    return "in_progress" if run_count > 0 else "not_started"


def get_my_training_for_schedule(
    schedule_id: int, user_id: int
) -> Training | None:
    return db.session.scalar(
        sa.select(Training).where(
            Training.schedule_id == schedule_id,
            Training.user_id == user_id,
        )
    )


def get_schedule_participants(
    schedule_id: int, user_id: int
) -> dict[str, object]:
    my_training = get_my_training_for_schedule(schedule_id, user_id)
    if my_training is None:
        raise ForbiddenError("Not enrolled", "You must be enrolled in this schedule to perform this action.")

    rows = db.session.execute(
        sa.text("""
            SELECT t.id, t.started_at, u.display_name, u.avatar_url
            FROM trainings t
            JOIN users u ON u.id = t.user_id
            WHERE t.schedule_id = :sid
            ORDER BY t.started_at ASC
        """),
        {"sid": schedule_id},
    ).all()

    participants: list[dict[str, object]] = [
        {
            "id": row.id,
            "displayName": row.display_name,
            "avatarUrl": row.avatar_url,
            "startedAt": row.started_at.isoformat(),
        }
        for row in rows
    ]
    return {"count": len(participants), "participants": participants}


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _interpolate_anchors(anchors: list[dict[str, float]], time_ms: int) -> float | None:
    if not anchors:
        return None
    if time_ms <= anchors[0]["timeMs"]:
        return anchors[0]["value"]
    if time_ms >= anchors[-1]["timeMs"]:
        return anchors[-1]["value"]
    for i in range(len(anchors) - 1):
        a, b = anchors[i], anchors[i + 1]
        if a["timeMs"] <= time_ms <= b["timeMs"]:
            if b["timeMs"] == a["timeMs"]:
                return a["value"]
            ratio = (time_ms - a["timeMs"]) / (b["timeMs"] - a["timeMs"])
            return a["value"] + ratio * (b["value"] - a["value"])
    return None


def _build_expected_anchors_from(
    start_ms: int,
    start_value: float,
    run_defs: list[RunDefinition],
    puzzle_count: int,
) -> list[dict[str, float]]:
    anchors: list[dict[str, float]] = [{"timeMs": float(start_ms), "value": start_value}]
    cursor = start_ms
    cumulative = start_value
    for run_def in run_defs:
        run_end_ms = cursor + int(run_def.target_hours * 3_600_000)
        cumulative += puzzle_count
        anchors.append({"timeMs": float(run_end_ms), "value": cumulative})
        if run_def.break_after_hours > 0:
            break_end_ms = run_end_ms + int(run_def.break_after_hours * 3_600_000)
            anchors.append({"timeMs": float(break_end_ms), "value": cumulative})
            cursor = break_end_ms
        else:
            cursor = run_end_ms
    return anchors


def _load_training_context(
    training_id: int,
    user_id: int,
) -> tuple[Training, ScheduleConfig, int]:
    training = _get_owned_training(training_id, user_id)
    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None or not isinstance(schedule.config, dict):
        raise NotFoundError("Schedule not found", "The requested schedule does not exist.")
    subset = db.session.get(Subset, schedule.subset_id)
    if subset is None:
        raise NotFoundError("Subset not found", "The requested subset does not exist.")
    schedule_cfg = ScheduleConfig.from_dict(schedule.config)
    puzzle_count = int(
        subset.locked_puzzle_count
        if subset.locked_puzzle_count is not None
        else (subset.puzzle_count or 0)
    )
    return training, schedule_cfg, puzzle_count


def _get_active_run_resolved(active_run: Run) -> tuple[int, int]:
    total_items = db.session.scalar(
        sa.select(sa.func.count()).where(RunTrainingItem.run_id == active_run.id)
    ) or 0
    resolved = db.session.scalar(
        sa.select(sa.func.count())
        .select_from(RunTrainingItem)
        .where(
            RunTrainingItem.run_id == active_run.id,
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
    return resolved, total_items


def get_training_progress(training_id: int, user_id: int) -> dict[str, object]:
    training, schedule_cfg, puzzle_count = _load_training_context(training_id, user_id)

    now = datetime.now(timezone.utc)
    now_ms = _ms(now)

    all_runs = list(
        db.session.scalars(
            sa.select(Run)
            .where(Run.training_id == training_id, Run.aborted_at.is_(None))
            .order_by(Run.run_index)
        ).all()
    )
    completed_runs = [r for r in all_runs if r.completed_at is not None]
    active_run = next((r for r in all_runs if r.completed_at is None), None)

    first_run = all_runs[0] if all_runs else None
    orig_start_ms = _ms(first_run.started_at) if first_run else now_ms

    original_anchors = _build_expected_anchors_from(orig_start_ms, 0.0, schedule_cfg.runs, puzzle_count)

    # Pre-compute active run resolved count once; used in both anchors sections.
    active_resolved = 0
    if active_run is not None:
        active_resolved, _ = _get_active_run_resolved(active_run)
    actual_at_now = len(completed_runs) * puzzle_count + active_resolved

    # Updated expected: anchored at the real current solve count at now_ms, then
    # projects forward using configured run durations from that point.
    updated_anchors: list[dict[str, float]] = []
    cursor_ms = orig_start_ms
    cumulative = 0.0
    completed_by_index = {r.run_index: r for r in completed_runs}

    for i, run_def in enumerate(schedule_cfg.runs):
        completed = completed_by_index.get(i)
        is_active = active_run is not None and active_run.run_index == i

        if completed is not None:
            run_start_ms = _ms(completed.started_at)
            run_end_ms = _ms(completed.completed_at)  # type: ignore[arg-type]
            updated_anchors.append({"timeMs": float(run_start_ms), "value": cumulative})
            cumulative += puzzle_count
            updated_anchors.append({"timeMs": float(run_end_ms), "value": cumulative})
            if run_def.break_after_hours > 0:
                break_end = run_end_ms + int(run_def.break_after_hours * 3_600_000)
                updated_anchors.append({"timeMs": float(break_end), "value": cumulative})
                cursor_ms = break_end
            else:
                cursor_ms = run_end_ms
        elif is_active:
            assert active_run is not None
            run_end_ms = _ms(active_run.started_at) + int(run_def.target_hours * 3_600_000)
            # Anchor at the actual current position so the dotted line starts where the
            # actual area ends, then slope to completing all run puzzles by the deadline.
            updated_anchors.append({"timeMs": float(now_ms), "value": float(actual_at_now)})
            cumulative += puzzle_count
            updated_anchors.append({"timeMs": float(run_end_ms), "value": cumulative})
            if run_def.break_after_hours > 0:
                break_end = run_end_ms + int(run_def.break_after_hours * 3_600_000)
                updated_anchors.append({"timeMs": float(break_end), "value": cumulative})
                cursor_ms = break_end
            else:
                cursor_ms = run_end_ms
        else:
            if not updated_anchors or updated_anchors[-1]["timeMs"] != float(cursor_ms):
                updated_anchors.append({"timeMs": float(cursor_ms), "value": cumulative})
            run_end_ms = cursor_ms + int(run_def.target_hours * 3_600_000)
            cumulative += puzzle_count
            updated_anchors.append({"timeMs": float(run_end_ms), "value": cumulative})
            if run_def.break_after_hours > 0:
                break_end = run_end_ms + int(run_def.break_after_hours * 3_600_000)
                updated_anchors.append({"timeMs": float(break_end), "value": cumulative})
                cursor_ms = break_end
            else:
                cursor_ms = run_end_ms

    if not updated_anchors:
        updated_anchors = [{"timeMs": float(orig_start_ms), "value": 0.0}]

    actual_anchors: list[dict[str, float]] = [{"timeMs": float(orig_start_ms), "value": 0.0}]
    cum_actual = 0.0
    last_actual_ms = orig_start_ms

    for run in sorted(all_runs, key=lambda r: r.started_at):
        run_start_ms = _ms(run.started_at)
        actual_anchors.append({"timeMs": float(run_start_ms), "value": cum_actual})
        if run.completed_at is not None:
            cum_actual += puzzle_count
            run_end_ms = _ms(run.completed_at)
            actual_anchors.append({"timeMs": float(run_end_ms), "value": cum_actual})
            last_actual_ms = run_end_ms
        else:
            actual_anchors.append({"timeMs": float(now_ms), "value": float(cum_actual + active_resolved)})
            last_actual_ms = now_ms

    # Guarantee the dotted updated-expected line starts exactly at today, not at
    # the next future anchor (which could be tomorrow or later for non-active runs).
    if not any(int(a["timeMs"]) == now_ms for a in updated_anchors):
        val_at_now = _interpolate_anchors(updated_anchors, now_ms)
        if val_at_now is not None:
            updated_anchors.append({"timeMs": float(now_ms), "value": val_at_now})
            updated_anchors.sort(key=lambda a: a["timeMs"])

    all_times = sorted(set(
        int(a["timeMs"]) for a in original_anchors + updated_anchors + actual_anchors
    ))

    total_expected_puzzles = len(schedule_cfg.runs) * puzzle_count

    points: list[dict[str, object]] = []
    for t in all_times:
        points.append({
            "timeMs": t,
            "originalExpected": _interpolate_anchors(original_anchors, t),
            "updatedExpected": _interpolate_anchors(updated_anchors, t) if t >= now_ms else None,
            "actual": _interpolate_anchors(actual_anchors, t) if t <= last_actual_ms else None,
        })

    return {
        "points": points,
        "totalExpectedPuzzles": total_expected_puzzles,
        "nowMs": now_ms,
    }


def get_training_detail_status(training_id: int, user_id: int, tz_str: str = "UTC") -> dict[str, object]:
    training, schedule_cfg, puzzle_count = _load_training_context(training_id, user_id)

    now = datetime.now(timezone.utc)
    now_ms = _ms(now)

    all_runs = list(
        db.session.scalars(
            sa.select(Run)
            .where(Run.training_id == training_id, Run.aborted_at.is_(None))
            .order_by(Run.run_index)
        ).all()
    )
    completed_runs = [r for r in all_runs if r.completed_at is not None]
    active_run = next((r for r in all_runs if r.completed_at is None), None)

    # Secondary: original calendar comparison
    first_run = all_runs[0] if all_runs else None
    orig_start_ms = _ms(first_run.started_at) if first_run else now_ms
    original_anchors = _build_expected_anchors_from(orig_start_ms, 0.0, schedule_cfg.runs, puzzle_count)
    original_expected_now = _interpolate_anchors(original_anchors, now_ms) or 0.0

    actual_resolved = len(completed_runs) * puzzle_count
    active_resolved = 0
    active_total_items = 0
    if active_run is not None:
        active_resolved, active_total_items = _get_active_run_resolved(active_run)
        actual_resolved += active_resolved

    secondary: dict[str, object] = {
        "originalExpectedResolvedByNow": round(original_expected_now),
        "actualResolved": actual_resolved,
        "deltaPuzzlesVsOriginal": actual_resolved - round(original_expected_now),
    }

    base = compute_training_state(
        completed_runs=completed_runs,
        active_run=active_run,
        schedule_cfg=schedule_cfg,
        training=training,
        now=now,
        tz_str=tz_str,
        active_resolved=active_resolved if active_run is not None else None,
        active_total_items=active_total_items if active_run is not None else None,
    )

    return {**base, **secondary}


def get_training_insights(
    schedule_id: int,
    user_id: int,
    run_indices: list[int],
    participant_ids: list[int],
) -> dict[str, object]:
    my_training = get_my_training_for_schedule(schedule_id, user_id)
    if my_training is None:
        raise ForbiddenError("Not enrolled", "You must be enrolled in this schedule to perform this action.")

    if participant_ids:
        enrolled_ids = list(
            db.session.scalars(
                sa.select(Training.id).where(
                    Training.id.in_(participant_ids),
                    Training.schedule_id == schedule_id,
                )
            ).all()
        )
        if len(enrolled_ids) != len(set(participant_ids)):
            raise ValidationError("Invalid participants", "One or more of the selected participants are not enrolled in this schedule.")

    return {"datapoints": []}


def get_training_run_solve_times(training_id: int) -> list[dict[str, object]]:
    training = db.session.get(Training, training_id)
    if training is None:
        raise NotFoundError("Training not found", "The requested training does not exist.")

    rows = db.session.execute(
        sa.text("""
            SELECT
                r.run_index,
                AVG(last_attempt.time_spent_ms) AS avg_solve_time_ms
            FROM runs r
            JOIN run_training_items rp ON rp.run_id = r.id
            JOIN LATERAL (
                SELECT pa.time_spent_ms
                FROM training_attempts pa
                WHERE pa.run_training_item_id = rp.id
                  AND pa.status != 'in_progress'
                ORDER BY pa.try_number DESC
                LIMIT 1
            ) last_attempt ON last_attempt.time_spent_ms IS NOT NULL
            WHERE r.training_id = :training_id
              AND r.aborted_at IS NULL
            GROUP BY r.id, r.run_index
            ORDER BY r.run_index
        """),
        {"training_id": training_id},
    ).all()

    return [
        {
            "runIndex": int(row.run_index),
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,
        }
        for row in rows
    ]
