import math
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.run import _pace_chart_data
from app.services.schedule_config import RunDefinition, ScheduleConfig

MS_PER_HOUR = 3_600_000
MS_PER_DAY = 24 * MS_PER_HOUR
MS_PER_WEEK = 7 * MS_PER_DAY

START = datetime(2026, 1, 5, 14, 37, 0, tzinfo=timezone.utc)  # Monday 14:37 UTC
START_MS = int(START.timestamp() * 1000)

TZ = "UTC"


def _make_run(
    run_index: int = 0,
    completed_at: datetime | None = None,
    aborted_at: datetime | None = None,
) -> object:
    return SimpleNamespace(
        run_index=run_index,
        started_at=START,
        completed_at=completed_at,
        aborted_at=aborted_at,
    )


def _make_schedule_cfg(target_hours: int, run_index: int = 0) -> ScheduleConfig:
    runs = [RunDefinition(target_hours=1, break_after_hours=0)] * run_index
    runs.append(RunDefinition(target_hours=target_hours, break_after_hours=0))
    return ScheduleConfig(runs=runs, puzzle_order="random", total_queue=1)


def _make_puzzles(solved_offsets_ms: list[int]) -> list[SimpleNamespace]:
    puzzles = []
    for offset in solved_offsets_ms:
        completed_at = datetime.fromtimestamp((START_MS + offset) / 1000, tz=timezone.utc)
        attempt = SimpleNamespace(status="solved", try_number=1, completed_at=completed_at)
        puzzles.append(SimpleNamespace(attempts=[attempt]))
    return puzzles


def _call(
    run_index: int = 0,
    target_hours: int = 168,
    solved_offsets_ms: list[int] | None = None,
    now_offset_ms: int = MS_PER_DAY,
    total_puzzles: int = 100,
    completed_offset_ms: int | None = None,
    aborted_offset_ms: int | None = None,
    tz: str = TZ,
) -> dict[str, object] | None:
    if solved_offsets_ms is None:
        solved_offsets_ms = []
    run = _make_run(
        run_index=run_index,
        completed_at=(
            datetime.fromtimestamp((START_MS + completed_offset_ms) / 1000, tz=timezone.utc)
            if completed_offset_ms is not None
            else None
        ),
        aborted_at=(
            datetime.fromtimestamp((START_MS + aborted_offset_ms) / 1000, tz=timezone.utc)
            if aborted_offset_ms is not None
            else None
        ),
    )
    schedule_cfg = _make_schedule_cfg(target_hours, run_index)
    puzzles = _make_puzzles(solved_offsets_ms)
    extra_empty = total_puzzles - len(solved_offsets_ms)
    for _ in range(extra_empty):
        puzzles.append(SimpleNamespace(attempts=[]))
    now_ms = START_MS + now_offset_ms
    now_dt = datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc)
    with patch("app.services.run.datetime") as mock_dt:
        mock_dt.now.return_value = now_dt
        mock_dt.fromtimestamp = datetime.fromtimestamp
        mock_dt.side_effect = datetime  # allows datetime(...) constructor calls
        result = _pace_chart_data(run, puzzles, schedule_cfg, tz)  # type: ignore[arg-type]
    return result


# ── return none ──────────────────────────────────────────────────────────────

class TestReturnNone:
    def test_run_index_out_of_bounds(self) -> None:
        run = _make_run(run_index=5)
        schedule_cfg = _make_schedule_cfg(168, run_index=0)
        assert _pace_chart_data(run, [], schedule_cfg) is None  # type: ignore[arg-type]


# ── required fields ───────────────────────────────────────────────────────────

class TestRequiredFields:
    def test_required_keys_present(self) -> None:
        result = _call()
        assert result is not None
        for key in (
            "runStatus", "startMs", "deadlineMs", "asOfMs",
            "domainStartMs", "domainEndMs", "totalItems", "resolvedItems",
            "requiredResolvedAtAsOf", "projectedFinishMs",
            "labelTicks", "series", "summary",
        ):
            assert key in result, f"Missing key: {key}"

    def test_start_and_deadline_ms(self) -> None:
        result = _call(target_hours=168)
        assert result is not None
        assert result["startMs"] == START_MS
        assert result["deadlineMs"] == START_MS + int(168.0 * MS_PER_HOUR)

    def test_domain_starts_at_start_ms(self) -> None:
        result = _call()
        assert result is not None
        assert result["domainStartMs"] == START_MS

    def test_total_items_matches_input(self) -> None:
        result = _call(total_puzzles=42)
        assert result is not None
        assert result["totalItems"] == 42


# ── run status ────────────────────────────────────────────────────────────────

class TestRunStatus:
    def test_active_run(self) -> None:
        result = _call(now_offset_ms=MS_PER_HOUR)
        assert result is not None
        assert result["runStatus"] == "active"

    def test_completed_run(self) -> None:
        result = _call(completed_offset_ms=MS_PER_WEEK - MS_PER_HOUR)
        assert result is not None
        assert result["runStatus"] == "completed"

    def test_aborted_run(self) -> None:
        result = _call(aborted_offset_ms=MS_PER_DAY * 3)
        assert result is not None
        assert result["runStatus"] == "aborted"


# ── as-of time ────────────────────────────────────────────────────────────────

class TestAsOfTime:
    def test_active_uses_now(self) -> None:
        now_offset = MS_PER_DAY
        result = _call(now_offset_ms=now_offset)
        assert result is not None
        assert result["asOfMs"] == START_MS + now_offset

    def test_completed_freezes_at_completed_at(self) -> None:
        completed_offset = MS_PER_WEEK - MS_PER_HOUR
        result = _call(now_offset_ms=MS_PER_WEEK, completed_offset_ms=completed_offset)
        assert result is not None
        assert result["asOfMs"] == START_MS + completed_offset

    def test_aborted_freezes_at_aborted_at(self) -> None:
        aborted_offset = MS_PER_DAY * 3
        result = _call(now_offset_ms=MS_PER_WEEK, aborted_offset_ms=aborted_offset)
        assert result is not None
        assert result["asOfMs"] == START_MS + aborted_offset


# ── domain end ────────────────────────────────────────────────────────────────

class TestDomainEnd:
    def test_active_on_pace_domain_ends_at_deadline(self) -> None:
        # Exactly on pace: projected finish ≈ deadline
        deadline_offset = int(168.0 * MS_PER_HOUR)
        result = _call(
            target_hours=168,
            solved_offsets_ms=[i * MS_PER_HOUR for i in range(1, 25)],
            now_offset_ms=MS_PER_DAY,
            total_puzzles=168,
        )
        assert result is not None
        deadline_ms = START_MS + deadline_offset
        # domain end >= deadline
        assert result["domainEndMs"] >= deadline_ms

    def test_active_behind_extends_domain_to_projected_finish(self) -> None:
        # No puzzles solved → projected finish is after deadline
        result = _call(
            target_hours=24,
            solved_offsets_ms=[],
            now_offset_ms=MS_PER_HOUR * 6,
            total_puzzles=100,
        )
        assert result is not None
        deadline_ms = START_MS + int(24 * MS_PER_HOUR)
        assert result["domainEndMs"] > deadline_ms
        assert result["projectedFinishMs"] is not None
        assert result["domainEndMs"] == result["projectedFinishMs"]

    def test_completed_before_deadline_domain_ends_at_deadline(self) -> None:
        completed_offset = MS_PER_DAY * 3
        result = _call(
            target_hours=168,
            completed_offset_ms=completed_offset,
            now_offset_ms=MS_PER_WEEK,
        )
        assert result is not None
        deadline_ms = START_MS + int(168 * MS_PER_HOUR)
        assert result["domainEndMs"] == deadline_ms

    def test_completed_after_deadline_extends_domain(self) -> None:
        deadline_ms = START_MS + int(24 * MS_PER_HOUR)
        completed_offset = int(30 * MS_PER_HOUR)
        result = _call(
            target_hours=24,
            completed_offset_ms=completed_offset,
            now_offset_ms=int(32 * MS_PER_HOUR),
        )
        assert result is not None
        assert result["domainEndMs"] == START_MS + completed_offset

    def test_aborted_before_deadline_domain_ends_at_deadline(self) -> None:
        aborted_offset = MS_PER_DAY * 2
        result = _call(
            target_hours=168,
            aborted_offset_ms=aborted_offset,
            now_offset_ms=MS_PER_WEEK,
        )
        assert result is not None
        deadline_ms = START_MS + int(168 * MS_PER_HOUR)
        assert result["domainEndMs"] == deadline_ms

    def test_aborted_after_deadline_extends_domain(self) -> None:
        aborted_offset = int(30 * MS_PER_HOUR)
        result = _call(
            target_hours=24,
            aborted_offset_ms=aborted_offset,
            now_offset_ms=int(32 * MS_PER_HOUR),
        )
        assert result is not None
        assert result["domainEndMs"] == START_MS + aborted_offset


# ── projection ────────────────────────────────────────────────────────────────

class TestProjection:
    def test_projection_only_for_active_runs(self) -> None:
        result = _call(completed_offset_ms=MS_PER_WEEK - MS_PER_HOUR)
        assert result is not None
        assert result["projectedFinishMs"] is None
        for point in result["series"]:  # type: ignore[union-attr]
            assert point["projection"] is None

    def test_aborted_has_no_projection(self) -> None:
        result = _call(aborted_offset_ms=MS_PER_DAY * 2)
        assert result is not None
        assert result["projectedFinishMs"] is None
        for point in result["series"]:  # type: ignore[union-attr]
            assert point["projection"] is None

    def test_active_all_resolved_no_projection(self) -> None:
        offsets = [i * MS_PER_HOUR for i in range(1, 11)]
        result = _call(solved_offsets_ms=offsets, now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        assert result["projectedFinishMs"] is None

    def test_projection_starts_at_as_of(self) -> None:
        now_offset = MS_PER_DAY
        result = _call(solved_offsets_ms=[], now_offset_ms=now_offset, total_puzzles=100)
        assert result is not None
        series = result["series"]
        now_ms = START_MS + now_offset
        as_of_point = next((p for p in series if p["timeMs"] == now_ms), None)  # type: ignore[union-attr]
        assert as_of_point is not None
        assert as_of_point["projection"] is not None
        assert as_of_point["actual"] is not None
        assert pytest.approx(as_of_point["projection"]) == as_of_point["actual"]

    def test_projection_reaches_total_at_projected_finish(self) -> None:
        result = _call(solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR, total_puzzles=100)
        assert result is not None
        pfms = result["projectedFinishMs"]
        assert pfms is not None
        series = result["series"]
        pf_point = next((p for p in series if p["timeMs"] == pfms), None)  # type: ignore[union-attr]
        assert pf_point is not None
        assert pf_point["projection"] == pytest.approx(100.0)

    def test_projection_null_before_as_of(self) -> None:
        result = _call(now_offset_ms=MS_PER_DAY, total_puzzles=100)
        assert result is not None
        now_ms = START_MS + MS_PER_DAY
        past = [p for p in result["series"] if p["timeMs"] < now_ms]  # type: ignore[union-attr]
        assert len(past) > 0
        for p in past:
            assert p["projection"] is None


# ── actual values ─────────────────────────────────────────────────────────────

class TestActualValues:
    def test_actual_null_after_as_of(self) -> None:
        result = _call(now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        now_ms = START_MS + MS_PER_DAY
        future = [p for p in result["series"] if p["timeMs"] > now_ms]  # type: ignore[union-attr]
        assert len(future) > 0
        for p in future:
            assert p["actual"] is None

    def test_actual_reflects_solved_count(self) -> None:
        solved = [MS_PER_HOUR, 2 * MS_PER_HOUR, 3 * MS_PER_HOUR]
        result = _call(solved_offsets_ms=solved, now_offset_ms=MS_PER_DAY, total_puzzles=20)
        assert result is not None
        now_ms = START_MS + MS_PER_DAY
        now_point = next(p for p in result["series"] if p["timeMs"] == now_ms)  # type: ignore[union-attr]
        assert now_point["actual"] == 3

    def test_actual_is_integer(self) -> None:
        result = _call(solved_offsets_ms=[MS_PER_HOUR], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        for p in result["series"]:  # type: ignore[union-attr]
            if p["actual"] is not None:
                assert isinstance(p["actual"], int)

    def test_future_actual_null_for_completed_run(self) -> None:
        # Completed before deadline; no actual values after completed_at
        completed_offset = MS_PER_DAY * 3
        result = _call(
            target_hours=168,
            solved_offsets_ms=[MS_PER_HOUR * i for i in range(1, 6)],
            completed_offset_ms=completed_offset,
            now_offset_ms=MS_PER_WEEK,
            total_puzzles=100,
        )
        assert result is not None
        as_of = result["asOfMs"]
        for p in result["series"]:  # type: ignore[union-attr]
            if p["timeMs"] > as_of:
                assert p["actual"] is None


# ── required line ─────────────────────────────────────────────────────────────

class TestRequiredLine:
    def test_required_zero_at_start(self) -> None:
        result = _call()
        assert result is not None
        start_pt = next(p for p in result["series"] if p["timeMs"] == START_MS)  # type: ignore[union-attr]
        assert start_pt["required"] == pytest.approx(0.0)

    def test_required_total_at_deadline(self) -> None:
        total = 100
        deadline_ms = START_MS + int(168 * MS_PER_HOUR)
        result = _call(total_puzzles=total)
        assert result is not None
        dl_pt = next(p for p in result["series"] if p["timeMs"] == deadline_ms)  # type: ignore[union-attr]
        assert dl_pt["required"] == pytest.approx(float(total))

    def test_required_flat_after_deadline(self) -> None:
        total = 100
        deadline_ms = START_MS + int(24 * MS_PER_HOUR)
        result = _call(
            target_hours=24,
            solved_offsets_ms=[],
            now_offset_ms=int(30 * MS_PER_HOUR),
            total_puzzles=total,
        )
        assert result is not None
        post_dl = [p for p in result["series"] if p["timeMs"] > deadline_ms]  # type: ignore[union-attr]
        assert len(post_dl) > 0
        for p in post_dl:
            assert p["required"] == pytest.approx(float(total))

    def test_required_decimal_between_start_and_deadline(self) -> None:
        result = _call(total_puzzles=7, target_hours=168)
        assert result is not None
        mid_ms = START_MS + int(84 * MS_PER_HOUR)
        series = result["series"]
        # Find series point closest to mid
        mid_pt = min(series, key=lambda p: abs(p["timeMs"] - mid_ms))  # type: ignore[union-attr]
        assert isinstance(mid_pt["required"], float)
        assert 0.0 < mid_pt["required"] < 7.0


# ── summary ───────────────────────────────────────────────────────────────────

class TestSummary:
    def test_summary_keys_present(self) -> None:
        result = _call()
        assert result is not None
        summary = result["summary"]
        for key in (
            "state", "resolvedItems", "totalItems", "remainingItems",
            "deltaItemsVsRequired", "deadlineDeltaMs",
            "projectedFinishMs", "completedAtMs", "abortedAtMs",
            "completedDeltaMs", "abortedDeltaMs",
        ):
            assert key in summary, f"Missing summary key: {key}"

    def test_active_on_pace(self) -> None:
        # At start, 0 resolved, 0 required → on pace
        result = _call(solved_offsets_ms=[], now_offset_ms=0, total_puzzles=100)
        assert result is not None
        assert result["summary"]["state"] == "active_on_pace"

    def test_active_behind(self) -> None:
        # No puzzles solved after 1 day in a 7-day run
        result = _call(solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=100)
        assert result is not None
        assert result["summary"]["state"] == "active_behind"

    def test_active_ahead(self) -> None:
        # All puzzles solved at midpoint of 7-day run
        offsets = [i * 100 for i in range(1, 15)]
        result = _call(
            target_hours=168,
            solved_offsets_ms=offsets,
            now_offset_ms=MS_PER_DAY // 2,
            total_puzzles=14,
        )
        assert result is not None
        assert result["summary"]["state"] == "active_ahead"

    def test_active_overdue(self) -> None:
        overdue_offset = int(168.0 * MS_PER_HOUR) + MS_PER_DAY
        result = _call(solved_offsets_ms=[], now_offset_ms=overdue_offset, total_puzzles=100)
        assert result is not None
        assert result["summary"]["state"] == "active_overdue"

    def test_completed_state(self) -> None:
        result = _call(completed_offset_ms=MS_PER_WEEK - MS_PER_HOUR)
        assert result is not None
        assert result["summary"]["state"] == "completed"

    def test_aborted_state(self) -> None:
        result = _call(aborted_offset_ms=MS_PER_DAY * 3)
        assert result is not None
        assert result["summary"]["state"] == "aborted"

    def test_completed_delta_positive_when_early(self) -> None:
        completed_offset = MS_PER_DAY * 3
        deadline_offset = int(168 * MS_PER_HOUR)
        result = _call(target_hours=168, completed_offset_ms=completed_offset)
        assert result is not None
        expected_delta = (START_MS + deadline_offset) - (START_MS + completed_offset)
        assert result["summary"]["completedDeltaMs"] == expected_delta
        assert expected_delta > 0

    def test_completed_delta_negative_when_late(self) -> None:
        completed_offset = int(30 * MS_PER_HOUR)
        result = _call(target_hours=24, completed_offset_ms=completed_offset)
        assert result is not None
        assert result["summary"]["completedDeltaMs"] is not None
        assert result["summary"]["completedDeltaMs"] < 0

    def test_aborted_delta_positive_before_deadline(self) -> None:
        aborted_offset = MS_PER_DAY * 2
        result = _call(target_hours=168, aborted_offset_ms=aborted_offset)
        assert result is not None
        assert result["summary"]["abortedDeltaMs"] is not None
        assert result["summary"]["abortedDeltaMs"] > 0

    def test_aborted_delta_negative_after_deadline(self) -> None:
        aborted_offset = int(30 * MS_PER_HOUR)
        result = _call(target_hours=24, aborted_offset_ms=aborted_offset)
        assert result is not None
        assert result["summary"]["abortedDeltaMs"] is not None
        assert result["summary"]["abortedDeltaMs"] < 0

    def test_deadline_delta_negative_when_overdue(self) -> None:
        overdue_offset = int(168 * MS_PER_HOUR) + MS_PER_DAY
        result = _call(now_offset_ms=overdue_offset, total_puzzles=10)
        assert result is not None
        assert result["summary"]["deadlineDeltaMs"] < 0

    def test_completed_at_ms_in_summary(self) -> None:
        completed_offset = MS_PER_DAY * 3
        result = _call(completed_offset_ms=completed_offset)
        assert result is not None
        assert result["summary"]["completedAtMs"] == START_MS + completed_offset

    def test_aborted_at_ms_in_summary(self) -> None:
        aborted_offset = MS_PER_DAY * 2
        result = _call(aborted_offset_ms=aborted_offset)
        assert result is not None
        assert result["summary"]["abortedAtMs"] == START_MS + aborted_offset

    def test_null_fields_for_active_run(self) -> None:
        result = _call()
        assert result is not None
        assert result["summary"]["completedAtMs"] is None
        assert result["summary"]["abortedAtMs"] is None
        assert result["summary"]["completedDeltaMs"] is None
        assert result["summary"]["abortedDeltaMs"] is None


# ── label ticks ───────────────────────────────────────────────────────────────

class TestLabelTicks:
    def test_label_ticks_are_objects(self) -> None:
        result = _call()
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert len(ticks) > 0
        for tick in ticks:
            assert "timeMs" in tick
            assert "kind" in tick
            assert "shortLabel" in tick

    def test_start_tick_present(self) -> None:
        result = _call()
        assert result is not None
        times = [t["timeMs"] for t in result["labelTicks"]]  # type: ignore[union-attr]
        assert START_MS in times

    def test_deadline_is_last_tick_when_domain_ends_at_deadline(self) -> None:
        # On-pace at start: projected_finish == deadline, so domain_end == deadline
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100)
        assert result is not None
        deadline_ms = START_MS + int(168 * MS_PER_HOUR)
        last_tick = result["labelTicks"][-1]  # type: ignore[index]
        assert last_tick["timeMs"] == deadline_ms

    def test_start_tick_kind(self) -> None:
        result = _call()
        assert result is not None
        start_tick = next(t for t in result["labelTicks"] if t["timeMs"] == START_MS)  # type: ignore[union-attr]
        assert start_tick["kind"] == "start"

    def test_deadline_tick_kind_when_last(self) -> None:
        # On-pace at start: domain ends at deadline, last tick has kind 'deadline'
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100)
        assert result is not None
        last_tick = result["labelTicks"][-1]  # type: ignore[index]
        assert last_tick["kind"] == "deadline"

    def test_projected_finish_tick_when_behind_active(self) -> None:
        result = _call(
            target_hours=24, solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR * 6, total_puzzles=100
        )
        assert result is not None
        pfms = result["projectedFinishMs"]
        assert pfms is not None
        assert pfms > START_MS + int(24 * MS_PER_HOUR)
        kinds = [t["kind"] for t in result["labelTicks"]]  # type: ignore[union-attr]
        assert "projected_finish" in kinds

    def test_no_projected_finish_tick_when_ahead(self) -> None:
        offsets = [i * MS_PER_HOUR for i in range(1, 25)]
        result = _call(
            target_hours=168,
            solved_offsets_ms=offsets,
            now_offset_ms=MS_PER_DAY,
            total_puzzles=24,
        )
        assert result is not None
        # Ahead: projected finish before deadline → not added as extra label tick
        pfms = result["projectedFinishMs"]
        deadline_ms = START_MS + int(168 * MS_PER_HOUR)
        if pfms is not None and pfms < deadline_ms:
            kinds = [t["kind"] for t in result["labelTicks"]]  # type: ignore[union-attr]
            assert "projected_finish" not in kinds

    def test_7_day_domain_has_8_ticks_total(self) -> None:
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100, tz="UTC")
        assert result is not None
        assert len(result["labelTicks"]) == 8  # type: ignore[arg-type]

    def test_7_day_domain_has_6_calendar_ticks(self) -> None:
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100, tz="UTC")
        assert result is not None
        calendar_ticks = [t for t in result["labelTicks"] if t["kind"] == "calendar"]  # type: ignore[union-attr]
        assert len(calendar_ticks) == 6  # 8 total − 1 start − 1 deadline

    def test_7_day_calendar_ticks_use_weekday_short_labels(self) -> None:
        # Ticks are 1 day apart so each falls on a distinct weekday
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100, tz="UTC")
        assert result is not None
        calendar_ticks = [t for t in result["labelTicks"] if t["kind"] == "calendar"]  # type: ignore[union-attr]
        days = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
        for tick in calendar_ticks:
            assert tick["shortLabel"] in days

    def test_longer_domain_has_7_ticks_total(self) -> None:
        # Behind run: projected finish extends domain beyond 7 days → n=7 ticks
        result = _call(target_hours=168, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=100)
        assert result is not None
        assert len(result["labelTicks"]) == 7  # type: ignore[arg-type]

    def test_ticks_are_uniformly_spaced(self) -> None:
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100, tz="UTC")
        assert result is not None
        times = [t["timeMs"] for t in result["labelTicks"]]  # type: ignore[union-attr]
        gaps = [times[i + 1] - times[i] for i in range(len(times) - 1)]
        # All gaps should be equal (uniform spacing)
        assert all(g == gaps[0] for g in gaps)

    def test_all_ticks_use_same_format_for_multi_day(self) -> None:
        # All labels on a 7-day chart must use the same format (weekday name only)
        result = _call(target_hours=168, now_offset_ms=0, total_puzzles=100, tz="UTC")
        assert result is not None
        days = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
        for tick in result["labelTicks"]:  # type: ignore[union-attr]
            assert tick["shortLabel"] in days, f"Mixed format: {tick['shortLabel']}"

    def test_sub_day_labels_are_time_format(self) -> None:
        result = _call(target_hours=6, now_offset_ms=MS_PER_HOUR, tz="UTC")
        assert result is not None
        for tick in result["labelTicks"]:  # type: ignore[union-attr]
            label = tick["shortLabel"]
            assert ":" in label, f"Expected HH:MM format, got: {label}"

    def test_label_ticks_are_sorted_ascending(self) -> None:
        result = _call()
        assert result is not None
        times = [t["timeMs"] for t in result["labelTicks"]]  # type: ignore[union-attr]
        assert times == sorted(times)


# ── series ────────────────────────────────────────────────────────────────────

class TestSeries:
    def test_series_contains_start(self) -> None:
        result = _call()
        assert result is not None
        times = [p["timeMs"] for p in result["series"]]  # type: ignore[union-attr]
        assert START_MS in times

    def test_series_contains_deadline(self) -> None:
        result = _call(target_hours=168)
        assert result is not None
        deadline_ms = START_MS + int(168 * MS_PER_HOUR)
        times = [p["timeMs"] for p in result["series"]]  # type: ignore[union-attr]
        assert deadline_ms in times

    def test_series_contains_all_label_tick_times(self) -> None:
        result = _call()
        assert result is not None
        series_times = {p["timeMs"] for p in result["series"]}  # type: ignore[union-attr]
        for tick in result["labelTicks"]:  # type: ignore[union-attr]
            assert tick["timeMs"] in series_times

    def test_start_point_has_start_kind(self) -> None:
        result = _call()
        assert result is not None
        start_pt = next(p for p in result["series"] if p["timeMs"] == START_MS)  # type: ignore[union-attr]
        assert start_pt.get("kind") == "start"

    def test_no_duplicate_times_in_series(self) -> None:
        result = _call()
        assert result is not None
        times = [p["timeMs"] for p in result["series"]]  # type: ignore[union-attr]
        assert len(times) == len(set(times))

    def test_series_points_not_one_per_puzzle(self) -> None:
        # 1000 puzzles solved at 1-second intervals should not create 1000 series points
        offsets = [i * 1000 for i in range(1, 1001)]
        result = _call(
            target_hours=168, solved_offsets_ms=offsets, total_puzzles=1000, now_offset_ms=MS_PER_WEEK
        )
        assert result is not None
        assert len(result["series"]) < 100  # type: ignore[arg-type]

    def test_required_and_projection_are_decimal(self) -> None:
        result = _call(total_puzzles=7, target_hours=168)
        assert result is not None
        for p in result["series"]:  # type: ignore[union-attr]
            assert isinstance(p["required"], float)
            if p["projection"] is not None:
                assert isinstance(p["projection"], float)
