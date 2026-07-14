from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from flask import Request

from app.utils import parse_multi_filter


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


class TableQuery:
    """Parses standard ServerDataTable query params from a Flask request.

    Wire format (produced by the frontend's tableParamsToUrl):
      page=1&pageSize=20&q=text
      userId=is&userId=1&userId=2   # repeated params; op prefix optional
      status=is&status=active       # repeated params; op prefix optional

    Calling str_filter('key') / int_filter('key') in an endpoint function
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
