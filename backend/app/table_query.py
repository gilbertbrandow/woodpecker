from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, cast

from flask import Request

from app.utils import FilterOp, parse_multi_filter

# ---------------------------------------------------------------------------
# Shared SQL-building helpers (bare conditions — callers join with AND)
# ---------------------------------------------------------------------------

def _apply_comparison(
    conditions: list[str],
    params: dict[str, object],
    column_expr: str,
    prefix: str,
    sql_op: str,
    val: object,
) -> None:
    conditions.append(f"{column_expr} {sql_op} :{prefix}_from")
    params[f"{prefix}_from"] = val


def _apply_between(
    conditions: list[str],
    params: dict[str, object],
    column_expr: str,
    prefix: str,
    from_val: object,
    to_val: object,
    negated: bool,
) -> None:
    not_ = "NOT " if negated else ""
    conditions.append(f"{column_expr} {not_}BETWEEN :{prefix}_from AND :{prefix}_to")
    params[f"{prefix}_from"] = from_val
    params[f"{prefix}_to"] = to_val


# ---------------------------------------------------------------------------
# Multi-value (entity / status) filters
# ---------------------------------------------------------------------------

@dataclass
class FilterList:
    op: FilterOp
    str_values: list[str] = field(default_factory=list)
    int_values: list[int] = field(default_factory=list)

    @property
    def str_or_none(self) -> list[str] | None:
        return self.str_values or None

    @property
    def int_or_none(self) -> list[int] | None:
        return self.int_values or None

    def apply(
        self,
        conditions: list[str],
        params: dict[str, object],
        column_expr: str,
        prefix: str = "list",
    ) -> None:
        if self.op == 'set':
            conditions.append(f"{column_expr} IS NOT NULL")
            return
        if self.op == 'not_set':
            conditions.append(f"{column_expr} IS NULL")
            return
        values: list[int] | list[str] = self.int_values or self.str_values
        if not values:
            return
        for i, v in enumerate(values):
            params[f"{prefix}_{i}"] = v
        placeholders = ", ".join(f":{prefix}_{i}" for i in range(len(values)))
        not_ = "NOT " if self.op == 'is_not' else ""
        conditions.append(f"{column_expr} {not_}IN ({placeholders})")

    def apply_orm(self, stmt: Any, column: Any) -> Any:
        if self.op == 'set':
            return stmt.where(column.is_not(None))
        if self.op == 'not_set':
            return stmt.where(column.is_(None))
        values: list[int] | list[str] = self.int_values or self.str_values
        if not values:
            return stmt
        if self.op == 'is_not':
            return stmt.where(column.not_in(values))
        return stmt.where(column.in_(values))

    def apply_status(self, conditions: list[str], status_sql: dict[str, str]) -> None:
        parts = [status_sql[v] for v in self.str_values if v in status_sql]
        if not parts:
            return
        inner = " OR ".join(parts)
        if self.op == 'is_not':
            conditions.append(f"NOT ({inner})")
        else:
            conditions.append(f"({inner})")


# ---------------------------------------------------------------------------
# Date filter  (wire: date=after&date=2024-01-15  or  date=between&date=…&date=…)
# ---------------------------------------------------------------------------

DateOp = Literal['after', 'before', 'between', 'not_between', 'set', 'not_set']
_DATE_OPS: frozenset[str] = frozenset({'after', 'before', 'between', 'not_between', 'set', 'not_set'})


@dataclass
class DateFilter:
    op: DateOp = 'after'
    from_date: str | None = None
    to_date: str | None = None

    @property
    def is_set(self) -> bool:
        return self.op in ('set', 'not_set') or self.from_date is not None

    def apply(
        self,
        conditions: list[str],
        params: dict[str, object],
        column_expr: str,
        prefix: str = "date",
    ) -> None:
        if not self.is_set:
            return
        if self.op == 'set':
            conditions.append(f"{column_expr} IS NOT NULL")
        elif self.op == 'not_set':
            conditions.append(f"{column_expr} IS NULL")
        elif self.op == 'after':
            _apply_comparison(conditions, params, column_expr, prefix, '>', self.from_date)
        elif self.op == 'before':
            _apply_comparison(conditions, params, column_expr, prefix, '<', self.from_date)
        elif self.op in ('between', 'not_between') and self.to_date:
            _apply_between(conditions, params, column_expr, prefix, self.from_date, self.to_date, self.op == 'not_between')


# ---------------------------------------------------------------------------
# Range filter  (wire: puzzleCount=gte&puzzleCount=100  or  …=between&…=100&…=500)
# ---------------------------------------------------------------------------

RangeOp = Literal['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between', 'set', 'not_set']
_RANGE_OPS: frozenset[str] = frozenset({'is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between', 'set', 'not_set'})


_RANGE_OP_SQL: dict[str, str] = {
    'is': '=', 'is_not': '!=',
    'gt': '>', 'gte': '>=', 'lt': '<', 'lte': '<=',
}


@dataclass
class RangeFilter:
    op: RangeOp = 'gte'
    from_val: float | None = None
    to_val: float | None = None

    @property
    def is_set(self) -> bool:
        return self.op in ('set', 'not_set') or self.from_val is not None

    def apply(
        self,
        conditions: list[str],
        params: dict[str, object],
        column_expr: str,
        prefix: str = "range",
        as_int: bool = False,
    ) -> None:
        if self.op == 'set':
            conditions.append(f"{column_expr} IS NOT NULL")
            return
        if self.op == 'not_set':
            conditions.append(f"{column_expr} IS NULL")
            return
        if not self.is_set or self.from_val is None:
            return
        coerce = int if as_int else float
        if self.op in _RANGE_OP_SQL:
            _apply_comparison(conditions, params, column_expr, prefix, _RANGE_OP_SQL[self.op], coerce(self.from_val))
        elif self.op in ('between', 'not_between') and self.to_val is not None:
            _apply_between(conditions, params, column_expr, prefix, coerce(self.from_val), coerce(self.to_val), self.op == 'not_between')


# ---------------------------------------------------------------------------
# TableQuery — parses standard ServerDataTable params from a Flask request
# ---------------------------------------------------------------------------

class TableQuery:
    """Parses standard ServerDataTable query params from a Flask request.

    Wire format (produced by the frontend's tableParamsToUrl):
      page=1&pageSize=20&q=text
      userId=is&userId=1&userId=2   # repeated params; op prefix optional
      status=is&status=active       # repeated params; op prefix optional
      date=after&date=2024-01-15    # repeated params; op then value(s)
      puzzleCount=gte&puzzleCount=100

    Calling str_filter/int_filter/date_filter/range_filter in an endpoint
    IS that endpoint's filter contract — no separate declaration needed.

    Use flag('key') for endpoint-specific boolean toggles (e.g. locked=true)
    that are not part of the table filter system.

    Search is always read from the 'q' param. When migrating an endpoint,
    rename any existing 'search' param to 'q' on both sides at the same time.
    """

    def __init__(self, req: Request) -> None:
        self._args = req.args
        try:
            self.page = max(1, int(self._args.get('page') or '1'))
        except ValueError:
            self.page = 1
        try:
            self.page_size = min(100, max(1, int(self._args.get('pageSize') or '20')))
        except ValueError:
            self.page_size = 20
        self.q = self._args.get('q') or None

    def flag(self, key: str) -> bool:
        return self._args.get(key) == 'true'

    def str_filter(self, key: str) -> FilterList:
        op, vals = parse_multi_filter(self._args.getlist(key))
        return FilterList(op=op, str_values=vals)

    def int_filter(self, key: str) -> FilterList:
        op, vals = parse_multi_filter(self._args.getlist(key))
        int_vals: list[int] = []
        for v in vals:
            try:
                int_vals.append(int(v))
            except ValueError:
                pass
        return FilterList(op=op, int_values=int_vals)

    def date_filter(self, key: str) -> DateFilter:
        tokens = self._args.getlist(key)
        if not tokens or tokens[0] not in _DATE_OPS:
            return DateFilter()
        op = cast(DateOp, tokens[0])
        if op in ('set', 'not_set'):
            return DateFilter(op=op)
        if len(tokens) < 2:
            return DateFilter()
        from_date = tokens[1] or None
        to_date = (tokens[2] or None) if len(tokens) >= 3 else None
        return DateFilter(op=op, from_date=from_date, to_date=to_date)

    def range_filter(self, key: str) -> RangeFilter:
        tokens = self._args.getlist(key)
        if not tokens or tokens[0] not in _RANGE_OPS:
            return RangeFilter()
        op = cast(RangeOp, tokens[0])
        if op in ('set', 'not_set'):
            return RangeFilter(op=op)
        if len(tokens) < 2:
            return RangeFilter()
        try:
            from_val = float(tokens[1])
        except ValueError:
            return RangeFilter()
        to_val: float | None = None
        if len(tokens) >= 3:
            try:
                to_val = float(tokens[2])
            except ValueError:
                pass
        return RangeFilter(op=op, from_val=from_val, to_val=to_val)
