from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, cast

from flask import Request

from app.utils import parse_multi_filter

# ---------------------------------------------------------------------------
# Multi-value (entity / status) filters
# ---------------------------------------------------------------------------

@dataclass
class FilterList:
    op: Literal['is', 'is_not']
    str_values: list[str] = field(default_factory=list)
    int_values: list[int] = field(default_factory=list)

    @property
    def str_or_none(self) -> list[str] | None:
        return self.str_values or None

    @property
    def int_or_none(self) -> list[int] | None:
        return self.int_values or None


# ---------------------------------------------------------------------------
# Date filter  (wire: date=after&date=2024-01-15  or  date=between&date=…&date=…)
# ---------------------------------------------------------------------------

DateOp = Literal['after', 'before', 'between', 'not_between']
_DATE_OPS: frozenset[str] = frozenset({'after', 'before', 'between', 'not_between'})


@dataclass
class DateFilter:
    op: DateOp = 'after'
    from_date: str | None = None
    to_date: str | None = None

    @property
    def is_set(self) -> bool:
        return self.from_date is not None


# ---------------------------------------------------------------------------
# Range filter  (wire: puzzleCount=gte&puzzleCount=100  or  …=between&…=100&…=500)
# ---------------------------------------------------------------------------

RangeOp = Literal['is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between']
_RANGE_OPS: frozenset[str] = frozenset({'is', 'is_not', 'gt', 'gte', 'lt', 'lte', 'between', 'not_between'})


@dataclass
class RangeFilter:
    op: RangeOp = 'gte'
    from_val: float | None = None
    to_val: float | None = None

    @property
    def is_set(self) -> bool:
        return self.from_val is not None


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
        if len(tokens) >= 2 and tokens[0] in _DATE_OPS:
            op = cast(DateOp, tokens[0])
            from_date = tokens[1] or None
            to_date = (tokens[2] or None) if len(tokens) >= 3 else None
            return DateFilter(op=op, from_date=from_date, to_date=to_date)
        return DateFilter()

    def range_filter(self, key: str) -> RangeFilter:
        tokens = self._args.getlist(key)
        if len(tokens) >= 2 and tokens[0] in _RANGE_OPS:
            op = cast(RangeOp, tokens[0])
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
        return RangeFilter()
