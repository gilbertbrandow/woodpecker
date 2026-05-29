from datetime import datetime, timezone

import sqlalchemy as sa

from app.extensions import db
from app.models.run import TrainingAttempt, Run, RunTrainingItem
from app.models.schedule import Schedule
from app.models.training import Training
from app.models.subset import Subset
from app.models.user import User
from app.exceptions import ConflictError, ValidationError
from app.services.schedule_config import ScheduleConfig
from app.services.training_state import compute_training_state


def _get_owned_training(training_id: int, user_id: int) -> Training:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")
    if training.user_id != user_id:
        raise PermissionError("Access denied.")
    return training


def training_full_dict(training: Training) -> dict[str, object]:
    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    subset = db.session.get(Subset, schedule.subset_id)
    if subset is None:
        raise LookupError("Subset not found.")
    creator = db.session.get(User, schedule.user_id)
    if creator is None:
        raise LookupError("Schedule creator not found.")
    owner = db.session.get(User, training.user_id)
    if owner is None:
        raise LookupError("Training owner not found.")

    if not isinstance(schedule.config, dict):
        raise LookupError("Schedule has no config.")
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

    return {
        "id": training.id,
        "scheduleId": training.schedule_id,
        "status": training_status(training),
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
        raise LookupError("Schedule not found.")
    if schedule.locked_at is None:
        raise ValidationError("Schedule must be locked before enrolling.")

    existing = db.session.scalar(
        sa.select(Training).where(
            Training.schedule_id == schedule_id,
            Training.user_id == user_id,
            Training.aborted_at.is_(None),
            Training.completed_at.is_(None),
        )
    )
    if existing is not None:
        raise ConflictError("Already enrolled in this schedule.")

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
        raise LookupError("Training not found.")
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
        raise ValidationError("targetAccuracy must be between 0 and 100.")
    if target_solve_seconds is not None and target_solve_seconds < 1:
        raise ValidationError("targetSolveSeconds must be at least 1.")

    run = db.session.scalar(
        sa.select(Run).where(
            Run.training_id == training_id,
            Run.run_index == run_index,
        )
    )
    if run is None:
        raise LookupError("Run not found.")
    run.target_accuracy = target_accuracy
    run.target_solve_seconds = target_solve_seconds
    db.session.commit()
    return run


def abort_training(training_id: int, user_id: int) -> Training:
    training = _get_owned_training(training_id, user_id)
    if training.completed_at is not None or training.aborted_at is not None:
        raise ConflictError("Training is already terminal.")
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


_STATUS_SQL: dict[str, str] = {
    "not_started": (
        "t.aborted_at IS NULL AND t.completed_at IS NULL"
        " AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id)"
    ),
    "in_progress": (
        "t.aborted_at IS NULL AND t.completed_at IS NULL"
        " AND EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id)"
    ),
    "completed": "t.aborted_at IS NULL AND t.completed_at IS NOT NULL",
    "aborted": "t.aborted_at IS NOT NULL",
}


def list_all_trainings(
    schedule_id: int | None = None,
    user_ids: list[int] | None = None,
    statuses: list[str] | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
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

    valid_statuses = [s for s in (statuses or []) if s in _STATUS_SQL]
    if valid_statuses:
        parts = " OR ".join(f"({_STATUS_SQL[s]})" for s in valid_statuses)
        conditions.append(f"({parts})")

    if search:
        conditions.append("s.name ILIKE :search")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    rows = db.session.execute(
        sa.text(f"""
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
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).all()

    total: int = db.session.scalar(
        sa.text(f"""
            SELECT COUNT(*)
            FROM trainings t
            JOIN schedules s ON s.id = t.schedule_id
            JOIN users u ON u.id = t.user_id
            {where}
        """),
        {k: v for k, v in params.items() if k not in ("limit", "offset")},
    ) or 0

    items: list[dict[str, object]] = []
    for row in rows:
        total_runs = len(ScheduleConfig.from_dict(row.config).runs) if isinstance(row.config, dict) else 0
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
            "user": {
                "id": row.user_id,
                "displayName": row.display_name,
                "avatarUrl": row.avatar_url,
            },
        })
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
        raise PermissionError("You are not enrolled in this schedule.")

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


def get_training_insights(
    schedule_id: int,
    user_id: int,
    run_indices: list[int],
    participant_ids: list[int],
) -> dict[str, object]:
    my_training = get_my_training_for_schedule(schedule_id, user_id)
    if my_training is None:
        raise PermissionError("You are not enrolled in this schedule.")

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
            raise ValidationError("Some participant ids do not belong to this schedule.")

    return {"datapoints": []}


def get_training_run_solve_times(training_id: int) -> list[dict[str, object]]:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")

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
