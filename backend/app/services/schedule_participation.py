from datetime import datetime, timezone
from typing import cast

import sqlalchemy as sa

from app.extensions import db
from app.models.run import Run
from app.models.schedule import Schedule
from app.models.schedule_participation import ScheduleParticipation
from app.models.subset import Subset
from app.models.user import User


def _compute_total_hours(config: dict[str, object]) -> int:
    runs_raw = config.get("runs")
    if not isinstance(runs_raw, list):
        return 0
    total = 0
    for run_item in runs_raw:
        if not isinstance(run_item, dict):
            continue
        run = cast(dict[str, object], run_item)
        target = run.get("target_hours")
        break_after = run.get("break_after_hours")
        total += (target if isinstance(target, int) else 0) + (
            break_after if isinstance(break_after, int) else 0
        )
    return total


def _get_owned_participation(participation_id: int, user_id: int) -> ScheduleParticipation:
    participation = db.session.get(ScheduleParticipation, participation_id)
    if participation is None:
        raise LookupError("Participation not found.")
    if participation.user_id != user_id:
        raise PermissionError("Access denied.")
    return participation


def participation_full_dict(participation: ScheduleParticipation) -> dict[str, object]:
    schedule = db.session.get(Schedule, participation.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    subset = db.session.get(Subset, schedule.subset_id)
    if subset is None:
        raise LookupError("Subset not found.")
    creator = db.session.get(User, schedule.user_id)
    if creator is None:
        raise LookupError("Schedule creator not found.")
    owner = db.session.get(User, participation.user_id)
    if owner is None:
        raise LookupError("Participation owner not found.")

    config = schedule.config if isinstance(schedule.config, dict) else {}
    runs_raw = config.get("runs")
    run_count = len(runs_raw) if isinstance(runs_raw, list) else 0
    order_raw = config.get("puzzle_order")
    puzzle_order = order_raw if isinstance(order_raw, str) else None
    total_hours = _compute_total_hours(config)

    puzzle_count = (
        subset.locked_puzzle_count
        if subset.locked_puzzle_count is not None
        else subset.puzzle_count
    ) or 0

    runs = db.session.scalars(
        sa.select(Run)
        .where(Run.participation_id == participation.id)
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
        "id": participation.id,
        "scheduleId": participation.schedule_id,
        "status": participation_status(participation),
        "startedAt": participation.started_at.isoformat(),
        "completedAt": participation.completed_at.isoformat() if participation.completed_at else None,
        "abortedAt": participation.aborted_at.isoformat() if participation.aborted_at else None,
        "ownerUsername": owner.lichess_username,
        "runTargets": run_targets,
        "schedule": {
            "id": schedule.id,
            "name": schedule.name,
            "description": schedule.description,
            "status": schedule.status,
            "totalHours": total_hours,
            "runCount": run_count,
            "runs": runs_raw if isinstance(runs_raw, list) else [],
            "puzzleOrder": puzzle_order,
            "createdBy": {
                "username": creator.lichess_username,
                "avatarUrl": creator.avatar_url,
            },
            "subset": {
                "id": subset.id,
                "name": subset.name,
                "puzzleCount": puzzle_count,
            },
        },
    }


def create_participation(user_id: int, schedule_id: int) -> ScheduleParticipation:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    if schedule.locked_at is None:
        raise ValueError("Schedule must be locked before enrolling.")

    existing = db.session.scalar(
        sa.select(ScheduleParticipation).where(
            ScheduleParticipation.schedule_id == schedule_id,
            ScheduleParticipation.user_id == user_id,
        )
    )
    if existing is not None:
        raise ValueError("Already enrolled in this schedule.")

    participation = ScheduleParticipation(
        user_id=user_id,
        schedule_id=schedule_id,
    )
    db.session.add(participation)
    db.session.commit()
    return participation


def get_participation(participation_id: int) -> ScheduleParticipation:
    participation = db.session.get(ScheduleParticipation, participation_id)
    if participation is None:
        raise LookupError("Participation not found.")
    return participation


def list_my_participations(user_id: int) -> list[dict[str, object]]:
    rows = db.session.execute(
        sa.text("""
            SELECT sp.id, sp.schedule_id,
                   sp.started_at, sp.completed_at, sp.aborted_at,
                   s.name AS schedule_name, s.subset_id, s.config,
                   CASE
                     WHEN sp.aborted_at IS NOT NULL THEN 'aborted'
                     WHEN sp.completed_at IS NOT NULL THEN 'completed'
                     WHEN EXISTS (SELECT 1 FROM runs r WHERE r.participation_id = sp.id) THEN 'in_progress'
                     ELSE 'draft'
                   END AS status
            FROM schedule_participations sp
            JOIN schedules s ON s.id = sp.schedule_id
            WHERE sp.user_id = :uid
            ORDER BY sp.started_at DESC
        """),
        {"uid": user_id},
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        config: dict[str, object] = row.config if isinstance(row.config, dict) else {}
        runs_raw = config.get("runs")
        total_runs = len(runs_raw) if isinstance(runs_raw, list) else 0
        result.append({
            "id": row.id,
            "scheduleId": row.schedule_id,
            "scheduleName": row.schedule_name,
            "subsetId": row.subset_id,
            "status": row.status,
            "runsCompleted": 0,
            "totalRuns": total_runs,
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
        })
    return result


def set_run_target(
    participation_id: int,
    user_id: int,
    run_index: int,
    target_accuracy: float | None,
    target_solve_seconds: int | None,
) -> Run:
    participation = _get_owned_participation(participation_id, user_id)

    if target_accuracy is not None and not (0.0 <= target_accuracy <= 100.0):
        raise ValueError("targetAccuracy must be between 0 and 100.")
    if target_solve_seconds is not None and target_solve_seconds < 1:
        raise ValueError("targetSolveSeconds must be at least 1.")

    run = db.session.scalar(
        sa.select(Run).where(
            Run.participation_id == participation_id,
            Run.run_index == run_index,
        )
    )
    if run is None:
        raise LookupError("Run not found.")
    run.target_accuracy = target_accuracy
    run.target_solve_seconds = target_solve_seconds
    db.session.commit()
    return run


def abort_participation(participation_id: int, user_id: int) -> ScheduleParticipation:
    participation = _get_owned_participation(participation_id, user_id)
    if participation.completed_at is not None or participation.aborted_at is not None:
        raise ValueError("Participation is already terminal.")
    participation.aborted_at = datetime.now(timezone.utc)
    db.session.commit()
    return participation


def list_all_participations(schedule_id: int | None = None) -> list[dict[str, object]]:
    where = "WHERE sp.schedule_id = :sid" if schedule_id is not None else ""
    rows = db.session.execute(
        sa.text(f"""
            SELECT sp.id, sp.schedule_id,
                   sp.started_at, sp.completed_at, sp.aborted_at,
                   s.name AS schedule_name, s.subset_id, s.config,
                   u.lichess_username, u.avatar_url,
                   CASE
                     WHEN sp.aborted_at IS NOT NULL THEN 'aborted'
                     WHEN sp.completed_at IS NOT NULL THEN 'completed'
                     WHEN EXISTS (SELECT 1 FROM runs r WHERE r.participation_id = sp.id) THEN 'in_progress'
                     ELSE 'draft'
                   END AS status
            FROM schedule_participations sp
            JOIN schedules s ON s.id = sp.schedule_id
            JOIN users u ON u.id = sp.user_id
            {where}
            ORDER BY sp.started_at DESC
        """),
        {"sid": schedule_id} if schedule_id is not None else {},
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        config: dict[str, object] = row.config if isinstance(row.config, dict) else {}
        runs_raw = config.get("runs")
        total_runs = len(runs_raw) if isinstance(runs_raw, list) else 0
        result.append({
            "id": row.id,
            "scheduleId": row.schedule_id,
            "scheduleName": row.schedule_name,
            "subsetId": row.subset_id,
            "status": row.status,
            "runsCompleted": 0,
            "totalRuns": total_runs,
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
            "user": {
                "username": row.lichess_username,
                "avatarUrl": row.avatar_url,
            },
        })
    return result


def participation_status(participation: ScheduleParticipation) -> str:
    if participation.aborted_at is not None:
        return "aborted"
    if participation.completed_at is not None:
        return "completed"
    run_count = db.session.scalar(
        sa.select(sa.func.count()).where(Run.participation_id == participation.id)
    ) or 0
    return "in_progress" if run_count > 0 else "draft"


def get_my_participation_for_schedule(
    schedule_id: int, user_id: int
) -> ScheduleParticipation | None:
    return db.session.scalar(
        sa.select(ScheduleParticipation).where(
            ScheduleParticipation.schedule_id == schedule_id,
            ScheduleParticipation.user_id == user_id,
        )
    )


def get_schedule_participants(
    schedule_id: int, user_id: int
) -> dict[str, object]:
    my_participation = get_my_participation_for_schedule(schedule_id, user_id)
    if my_participation is None:
        raise PermissionError("You are not enrolled in this schedule.")

    rows = db.session.execute(
        sa.text("""
            SELECT sp.id, sp.started_at, u.lichess_username, u.avatar_url
            FROM schedule_participations sp
            JOIN users u ON u.id = sp.user_id
            WHERE sp.schedule_id = :sid
            ORDER BY sp.started_at ASC
        """),
        {"sid": schedule_id},
    ).all()

    participants: list[dict[str, object]] = [
        {
            "id": row.id,
            "username": row.lichess_username,
            "avatarUrl": row.avatar_url,
            "startedAt": row.started_at.isoformat(),
        }
        for row in rows
    ]
    return {"count": len(participants), "participants": participants}


def get_participation_insights(
    schedule_id: int,
    user_id: int,
    run_indices: list[int],
    participant_ids: list[int],
) -> dict[str, object]:
    my_participation = get_my_participation_for_schedule(schedule_id, user_id)
    if my_participation is None:
        raise PermissionError("You are not enrolled in this schedule.")

    if participant_ids:
        enrolled_ids = list(
            db.session.scalars(
                sa.select(ScheduleParticipation.id).where(
                    ScheduleParticipation.id.in_(participant_ids),
                    ScheduleParticipation.schedule_id == schedule_id,
                )
            ).all()
        )
        if len(enrolled_ids) != len(set(participant_ids)):
            raise ValueError("Some participant ids do not belong to this schedule.")

    return {"datapoints": []}
