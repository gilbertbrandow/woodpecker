import math
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.run import _pace_chart_data

MS_PER_HOUR = 3_600_000
MS_PER_DAY = 24 * MS_PER_HOUR

START = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
START_MS = int(START.timestamp() * 1000)


def _make_run(run_index: int = 0) -> object:
    return SimpleNamespace(run_index=run_index, started_at=START)


def _make_config(target_hours: float, run_index: int = 0) -> dict[str, object]:
    runs: list[object] = [None] * (run_index + 1)
    runs[run_index] = {"target_hours": target_hours}
    return {"runs": runs}


def _make_puzzles(solved_offsets_ms: list[int]) -> list[SimpleNamespace]:
    puzzles = []
    for offset in solved_offsets_ms:
        completed_at = datetime.fromtimestamp((START_MS + offset) / 1000, tz=timezone.utc)
        attempt = SimpleNamespace(
            status="solved",
            try_number=1,
            completed_at=completed_at,
        )
        puzzles.append(SimpleNamespace(attempts=[attempt]))
    return puzzles


def _call(
    run_index: int,
    target_hours: float,
    solved_offsets_ms: list[int],
    now_offset_ms: int,
    total_puzzles: int | None = None,
) -> dict[str, object] | None:
    run = _make_run(run_index)
    config = _make_config(target_hours, run_index)
    n = total_puzzles if total_puzzles is not None else len(solved_offsets_ms)
    puzzles = _make_puzzles(solved_offsets_ms)
    extra_empty = n - len(solved_offsets_ms)
    for _ in range(extra_empty):
        puzzles.append(SimpleNamespace(attempts=[]))
    now_ms = START_MS + now_offset_ms
    now_dt = datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc)
    with patch("app.services.run.datetime") as mock_dt:
        mock_dt.now.return_value = now_dt
        mock_dt.fromtimestamp = datetime.fromtimestamp
        result = _pace_chart_data(run, puzzles, config, total_queue=1)  # type: ignore[arg-type]
    return result


class TestReturnNone:
    def test_missing_runs_key(self) -> None:
        run = _make_run()
        assert _pace_chart_data(run, [], {}, 1) is None  # type: ignore[arg-type]

    def test_run_index_out_of_bounds(self) -> None:
        run = _make_run(run_index=5)
        config = _make_config(168.0, run_index=0)
        assert _pace_chart_data(run, [], config, 1) is None  # type: ignore[arg-type]

    def test_zero_target_hours(self) -> None:
        run = _make_run()
        config = _make_config(0.0)
        assert _pace_chart_data(run, [], config, 1) is None  # type: ignore[arg-type]

    def test_negative_target_hours(self) -> None:
        run = _make_run()
        config = _make_config(-10.0)
        assert _pace_chart_data(run, [], config, 1) is None  # type: ignore[arg-type]


class TestLabelTicks:
    def test_7_day_run_produces_8_ticks(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=100)
        assert result is not None
        assert len(result["labelTicks"]) == 8  # type: ignore[arg-type]

    def test_label_ticks_start_at_start_ms(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert ticks[0] == START_MS

    def test_label_ticks_end_at_deadline(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        deadline_ms = START_MS + int(168.0 * MS_PER_HOUR)
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert ticks[-1] == deadline_ms

    def test_1_day_run_produces_7_ticks(self) -> None:
        result = _call(0, target_hours=24.0, solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR, total_puzzles=10)
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert len(ticks) == 7

    def test_48_hour_run_produces_7_ticks(self) -> None:
        result = _call(0, target_hours=48.0, solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR, total_puzzles=10)
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert len(ticks) == 7

    def test_1_day_run_uses_4h_intervals(self) -> None:
        result = _call(0, target_hours=24.0, solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR, total_puzzles=10)
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert ticks[1] - ticks[0] == 4 * MS_PER_HOUR

    def test_48_hour_run_uses_8h_intervals(self) -> None:
        result = _call(0, target_hours=48.0, solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR, total_puzzles=10)
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert ticks[1] - ticks[0] == 8 * MS_PER_HOUR

    def test_sub_day_run_uses_hourly_ticks(self) -> None:
        result = _call(0, target_hours=6.0, solved_offsets_ms=[], now_offset_ms=MS_PER_HOUR, total_puzzles=10)
        assert result is not None
        ticks = result["labelTicks"]
        assert isinstance(ticks, list)
        assert len(ticks) == 7


class TestRequiredFields:
    def test_required_keys_present(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        for key in ("startMs", "deadlineMs", "totalPuzzles", "labelTicks", "domainStartMs", "series", "status", "puzzleDelta", "timeRemainingMs"):
            assert key in result, f"Missing key: {key}"

    def test_start_and_deadline_ms(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        assert result["startMs"] == START_MS
        assert result["deadlineMs"] == START_MS + int(168.0 * MS_PER_HOUR)

    def test_total_puzzles_matches_input(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=42)
        assert result is not None
        assert result["totalPuzzles"] == 42


class TestPaceStatus:
    def test_on_pace_when_no_puzzles_just_started(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=0, total_puzzles=100)
        assert result is not None
        assert result["status"] == "on_pace"

    def test_behind_when_no_puzzles_solved_after_day_1(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=100)
        assert result is not None
        assert result["status"] == "behind"

    def test_ahead_when_all_puzzles_solved_at_midpoint(self) -> None:
        total = 14
        half_day = MS_PER_DAY // 2
        offsets = [i * 1000 for i in range(total)]
        result = _call(0, target_hours=168.0, solved_offsets_ms=offsets, now_offset_ms=half_day, total_puzzles=total)
        assert result is not None
        assert result["status"] == "ahead"

    def test_on_pace_with_one_puzzle_delta(self) -> None:
        total = 100
        half_day = MS_PER_DAY // 2
        expected_at_half_day = round((half_day / (168 * MS_PER_HOUR)) * total)
        offsets = [i * 1000 for i in range(expected_at_half_day + 1)]
        result = _call(0, target_hours=168.0, solved_offsets_ms=offsets, now_offset_ms=half_day, total_puzzles=total)
        assert result is not None
        assert result["status"] == "on_pace"

    def test_time_remaining_ms_is_negative_when_overdue(self) -> None:
        overdue_offset = int(168.0 * MS_PER_HOUR) + MS_PER_DAY
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=overdue_offset, total_puzzles=10)
        assert result is not None
        time_remaining = result["timeRemainingMs"]
        assert isinstance(time_remaining, int)
        assert time_remaining < 0


class TestSeries:
    def test_series_contains_start_tick(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        series = result["series"]
        assert isinstance(series, list)
        time_values = [s["timeMs"] for s in series]
        assert START_MS in time_values

    def test_target_at_start_is_zero(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        series = result["series"]
        assert isinstance(series, list)
        start_tick = next(s for s in series if s["timeMs"] == START_MS)
        assert start_tick["target"] == pytest.approx(0.0)

    def test_target_at_deadline_equals_total_puzzles(self) -> None:
        total = 10
        deadline_ms = START_MS + int(168.0 * MS_PER_HOUR)
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=total)
        assert result is not None
        series = result["series"]
        assert isinstance(series, list)
        deadline_tick = next((s for s in series if s["timeMs"] == deadline_ms), None)
        assert deadline_tick is not None
        assert deadline_tick["target"] == pytest.approx(float(total))

    def test_actual_at_now_reflects_solved_count(self) -> None:
        now_offset = MS_PER_DAY
        solved_offsets = [MS_PER_HOUR * i for i in range(1, 5)]
        result = _call(0, target_hours=168.0, solved_offsets_ms=solved_offsets, now_offset_ms=now_offset, total_puzzles=20)
        assert result is not None
        series = result["series"]
        assert isinstance(series, list)
        now_ms = START_MS + now_offset
        now_tick = next((s for s in series if s["timeMs"] == now_ms), None)
        assert now_tick is not None
        assert now_tick["actual"] == 4

    def test_actual_is_none_for_future_ticks(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        series = result["series"]
        assert isinstance(series, list)
        now_ms = START_MS + MS_PER_DAY
        future_ticks = [s for s in series if s["timeMs"] > now_ms]
        assert len(future_ticks) > 0
        for tick in future_ticks:
            assert tick["actual"] is None

    def test_projection_is_none_for_past_ticks(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        series = result["series"]
        assert isinstance(series, list)
        now_ms = START_MS + MS_PER_DAY
        past_ticks = [s for s in series if s["timeMs"] < now_ms]
        assert len(past_ticks) > 0
        for tick in past_ticks:
            assert tick["projection"] is None

    def test_domain_start_is_before_start_ms(self) -> None:
        result = _call(0, target_hours=168.0, solved_offsets_ms=[], now_offset_ms=MS_PER_DAY, total_puzzles=10)
        assert result is not None
        domain_start = result["domainStartMs"]
        assert isinstance(domain_start, int)
        assert domain_start < START_MS
