from dataclasses import dataclass
from typing import cast

MAX_RUNS = 20
MAX_REPEATS = 5
VALID_PUZZLE_ORDERS = frozenset({"random", "fixed", "rating_asc", "rating_desc"})


@dataclass(frozen=True)
class RunDefinition:
    target_hours: int
    break_after_hours: int


@dataclass(frozen=True)
class ScheduleConfig:
    runs: list[RunDefinition]
    puzzle_order: str
    total_queue: int

    @property
    def total_hours(self) -> int:
        return sum(r.target_hours + r.break_after_hours for r in self.runs)

    @staticmethod
    def from_dict(d: dict[str, object]) -> "ScheduleConfig":
        runs_raw = d.get("runs")
        if not isinstance(runs_raw, list):
            raise ValueError("config.runs must be a list.")
        if not runs_raw:
            raise ValueError("config.runs must have at least one entry.")
        if len(runs_raw) > MAX_RUNS:
            raise ValueError(f"config.runs must have at most {MAX_RUNS} entries.")
        runs: list[RunDefinition] = []
        for i, run_item in enumerate(runs_raw):
            if not isinstance(run_item, dict):
                raise ValueError(f"config.runs[{i}] must be an object.")
            run = cast(dict[str, object], run_item)
            target_hours = run.get("target_hours")
            break_after = run.get("break_after_hours")
            if not isinstance(target_hours, int) or target_hours < 1:
                raise ValueError(f"config.runs[{i}].target_hours must be a positive integer.")
            if not isinstance(break_after, int) or break_after < 0:
                raise ValueError(f"config.runs[{i}].break_after_hours must be a non-negative integer.")
            runs.append(RunDefinition(target_hours=target_hours, break_after_hours=break_after))

        order_raw = d.get("puzzle_order")
        if order_raw not in VALID_PUZZLE_ORDERS:
            raise ValueError(
                f"config.puzzle_order must be one of: {', '.join(sorted(VALID_PUZZLE_ORDERS))}."
            )
        puzzle_order = cast(str, order_raw)

        rep_raw = d.get("failed_repetition")
        if not isinstance(rep_raw, dict):
            raise ValueError("config.failed_repetition must be an object.")
        rep = cast(dict[str, object], rep_raw)
        mode = rep.get("mode")
        if mode not in ("none", "queue"):
            raise ValueError("config.failed_repetition.mode must be 'none' or 'queue'.")
        total_queue = 1
        if mode == "queue":
            max_repeats = rep.get("max_repeats")
            if not isinstance(max_repeats, int) or not (1 <= max_repeats <= MAX_REPEATS):
                raise ValueError(
                    f"config.failed_repetition.max_repeats must be an integer between 1 and {MAX_REPEATS}."
                )
            total_queue = 1 + max_repeats

        return ScheduleConfig(runs=runs, puzzle_order=puzzle_order, total_queue=total_queue)
