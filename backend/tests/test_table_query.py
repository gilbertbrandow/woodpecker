"""Unit tests for table_query filter types — no DB or Flask context needed."""
from unittest.mock import MagicMock

from app.table_query import (
    DateFilter,
    FilterList,
    Paginator,
    RangeFilter,
    SetFilter,
    SortParam,
    TableQuery,
)

# ---------------------------------------------------------------------------
# FilterList.apply_status
# ---------------------------------------------------------------------------

_STATUS_SQL = {
    "locked": "t.locked_at IS NOT NULL",
    "draft": "t.locked_at IS NULL",
}


def test_apply_status_is_single() -> None:
    f = FilterList(op='is', str_values=['locked'])
    conditions: list[str] = []
    f.apply_status(conditions, _STATUS_SQL)
    assert conditions == ["(t.locked_at IS NOT NULL)"]


def test_apply_status_is_multi() -> None:
    f = FilterList(op='is', str_values=['locked', 'draft'])
    conditions: list[str] = []
    f.apply_status(conditions, _STATUS_SQL)
    assert conditions == ["(t.locked_at IS NOT NULL OR t.locked_at IS NULL)"]


def test_apply_status_is_not() -> None:
    f = FilterList(op='is_not', str_values=['locked'])
    conditions: list[str] = []
    f.apply_status(conditions, _STATUS_SQL)
    assert conditions == ["NOT (t.locked_at IS NOT NULL)"]


def test_apply_status_unknown_values_ignored() -> None:
    f = FilterList(op='is', str_values=['nonexistent', 'also_unknown'])
    conditions: list[str] = []
    f.apply_status(conditions, _STATUS_SQL)
    assert conditions == []


def test_apply_status_empty_values_no_op() -> None:
    f = FilterList(op='is', str_values=[])
    conditions: list[str] = []
    f.apply_status(conditions, _STATUS_SQL)
    assert conditions == []


def test_apply_status_mixed_valid_unknown() -> None:
    # Unknown values are silently skipped; known ones still apply.
    f = FilterList(op='is', str_values=['locked', 'unknown'])
    conditions: list[str] = []
    f.apply_status(conditions, _STATUS_SQL)
    assert conditions == ["(t.locked_at IS NOT NULL)"]


# ---------------------------------------------------------------------------
# FilterList.apply_orm
# ---------------------------------------------------------------------------

class _FakeStmt:
    """Minimal stand-in for a SQLAlchemy Select to test apply_orm without DB."""
    def __init__(self) -> None:
        self.clauses: list[object] = []

    def where(self, clause: object) -> "_FakeStmt":
        self.clauses.append(clause)
        return self


class _FakeColumn:
    def __init__(self, name: str) -> None:
        self.name = name

    def in_(self, values: list) -> str:  # type: ignore[override]
        return f"{self.name} IN {values}"

    def not_in(self, values: list) -> str:  # type: ignore[override]
        return f"{self.name} NOT IN {values}"

    def is_not(self, value: object) -> str:  # type: ignore[override]
        return f"{self.name} IS NOT {value}"

    def is_(self, value: object) -> str:  # type: ignore[override]
        return f"{self.name} IS {value}"


def test_apply_orm_is() -> None:
    f = FilterList(op='is', int_values=[1, 2])
    stmt = _FakeStmt()
    col = _FakeColumn("user_id")
    result = f.apply_orm(stmt, col)
    assert result.clauses == ["user_id IN [1, 2]"]


def test_apply_orm_is_not() -> None:
    f = FilterList(op='is_not', int_values=[3])
    stmt = _FakeStmt()
    col = _FakeColumn("user_id")
    result = f.apply_orm(stmt, col)
    assert result.clauses == ["user_id NOT IN [3]"]


def test_apply_orm_empty_is_noop() -> None:
    f = FilterList(op='is', int_values=[])
    stmt = _FakeStmt()
    col = _FakeColumn("user_id")
    result = f.apply_orm(stmt, col)
    assert result.clauses == []


def test_apply_orm_uses_str_values_when_no_ints() -> None:
    f = FilterList(op='is', str_values=['solved'])
    stmt = _FakeStmt()
    col = _FakeColumn("status")
    result = f.apply_orm(stmt, col)
    assert result.clauses == ["status IN ['solved']"]


# ---------------------------------------------------------------------------
# FilterList.apply — null-ops
# ---------------------------------------------------------------------------

def test_apply_is_set() -> None:
    f = FilterList(op='set', str_values=[])
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.col", prefix="x")
    assert conditions == ["t.col IS NOT NULL"]
    assert params == {}


def test_apply_not_set() -> None:
    f = FilterList(op='not_set', str_values=[])
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.col", prefix="x")
    assert conditions == ["t.col IS NULL"]
    assert params == {}


# ---------------------------------------------------------------------------
# FilterList.apply_orm — null-ops
# ---------------------------------------------------------------------------

def test_apply_orm_is_set() -> None:
    f = FilterList(op='set', int_values=[])
    stmt = _FakeStmt()
    col = _FakeColumn("col")
    result = f.apply_orm(stmt, col)
    assert result.clauses == ["col IS NOT None"]


def test_apply_orm_not_set() -> None:
    f = FilterList(op='not_set', int_values=[])
    stmt = _FakeStmt()
    col = _FakeColumn("col")
    result = f.apply_orm(stmt, col)
    assert result.clauses == ["col IS None"]


# ---------------------------------------------------------------------------
# DateFilter.apply — null-ops
# ---------------------------------------------------------------------------

def test_date_filter_set() -> None:
    f = DateFilter(op='set')
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "DATE(t.completed_at)", prefix="ca")
    assert conditions == ["DATE(t.completed_at) IS NOT NULL"]
    assert params == {}


def test_date_filter_not_set() -> None:
    f = DateFilter(op='not_set')
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "DATE(t.completed_at)", prefix="ca")
    assert conditions == ["DATE(t.completed_at) IS NULL"]
    assert params == {}


# ---------------------------------------------------------------------------
# RangeFilter.apply — null-ops
# ---------------------------------------------------------------------------

def test_range_filter_set() -> None:
    f = RangeFilter(op='set')
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.puzzle_count", prefix="pc")
    assert conditions == ["t.puzzle_count IS NOT NULL"]
    assert params == {}


def test_range_filter_not_set() -> None:
    f = RangeFilter(op='not_set')
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.puzzle_count", prefix="pc")
    assert conditions == ["t.puzzle_count IS NULL"]
    assert params == {}


# ---------------------------------------------------------------------------
# SetFilter — str_values
# ---------------------------------------------------------------------------

def test_set_filter_is_set_with_str_values() -> None:
    f = SetFilter(op='overlaps', str_values=['fork', 'pin'])
    assert f.is_set is True


def test_set_filter_is_set_empty_is_false() -> None:
    f = SetFilter()
    assert f.is_set is False


def test_set_filter_is_set_with_int_values() -> None:
    f = SetFilter(op='overlaps', int_values=[1, 2])
    assert f.is_set is True


def test_set_filter_str_values_default_empty() -> None:
    f = SetFilter()
    assert f.str_values == []
    assert f.int_values == []


def test_set_filter_apply_int_overlaps() -> None:
    f = SetFilter(op='overlaps', int_values=[10, 20])
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.tag_ids", prefix="tags")
    assert len(conditions) == 1
    assert "&&" in conditions[0]
    assert params == {"tags_0": 10, "tags_1": 20}


def test_set_filter_apply_int_disjoint() -> None:
    f = SetFilter(op='disjoint', int_values=[5])
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.tag_ids", prefix="tags")
    assert conditions[0].startswith("NOT (")
    assert "&&" in conditions[0]


def test_set_filter_apply_noop_when_empty() -> None:
    f = SetFilter()
    conditions: list[str] = []
    params: dict[str, object] = {}
    f.apply(conditions, params, "t.tag_ids", prefix="tags")
    assert conditions == []
    assert params == {}


# ---------------------------------------------------------------------------
# Paginator
# ---------------------------------------------------------------------------

def test_paginator_params_page1() -> None:
    p = Paginator(page=1, page_size=20)
    assert p.params == {'page_limit': 20, 'page_offset': 0}


def test_paginator_params_page2() -> None:
    p = Paginator(page=2, page_size=20)
    assert p.params == {'page_limit': 20, 'page_offset': 20}


def test_paginator_paginate_empty() -> None:
    p = Paginator(page=1, page_size=20)
    items, total = p.paginate([], lambda r: r)
    assert items == []
    assert total == 0


def test_paginator_paginate_maps_rows() -> None:
    p = Paginator(page=1, page_size=20)

    row1 = MagicMock()
    row1.total_count = 5
    row1.value = 'a'
    row2 = MagicMock()
    row2.total_count = 5
    row2.value = 'b'

    items, total = p.paginate([row1, row2], lambda r: r.value)
    assert total == 5
    assert items == ['a', 'b']


# ---------------------------------------------------------------------------
# SortParam / TableQuery.sort_param
# ---------------------------------------------------------------------------

_SORT_ALLOWLIST: dict[str, str] = {
    'accuracyPct': 'accuracy_pct',
    'avgRating': 'rs.avg_rating',
}


def _make_table_query(args: dict) -> TableQuery:
    req = MagicMock()
    req.args = MagicMock()
    req.args.get = lambda k, d=None: args.get(k, d)
    req.args.getlist = lambda k: ([args[k]] if k in args and not isinstance(args[k], list) else args.get(k, []))
    return TableQuery(req)


def test_sort_param_none_when_missing() -> None:
    q = _make_table_query({})
    assert q.sort_param(_SORT_ALLOWLIST) is None


def test_sort_param_none_when_unknown_column() -> None:
    q = _make_table_query({'sort': 'unknown:desc'})
    assert q.sort_param(_SORT_ALLOWLIST) is None


def test_sort_param_none_when_invalid_dir() -> None:
    q = _make_table_query({'sort': 'accuracyPct:sideways'})
    assert q.sort_param(_SORT_ALLOWLIST) is None


def test_sort_param_valid_desc() -> None:
    q = _make_table_query({'sort': 'accuracyPct:desc'})
    sp = q.sort_param(_SORT_ALLOWLIST)
    assert sp is not None
    assert sp.key == 'accuracyPct'
    assert sp.dir == 'desc'
    assert sp.sql_expr == 'accuracy_pct'


def test_sort_param_valid_asc() -> None:
    q = _make_table_query({'sort': 'avgRating:asc'})
    sp = q.sort_param(_SORT_ALLOWLIST)
    assert sp is not None
    assert sp.key == 'avgRating'
    assert sp.dir == 'asc'
    assert sp.sql_expr == 'rs.avg_rating'


def test_sort_order_by_desc() -> None:
    sp = SortParam(key='accuracyPct', dir='desc', sql_expr='rs.avg_rating')
    assert sp.order_by_clause() == 'rs.avg_rating DESC NULLS LAST'


def test_sort_order_by_asc() -> None:
    sp = SortParam(key='avgRating', dir='asc', sql_expr='rs.avg_rating')
    assert sp.order_by_clause() == 'rs.avg_rating ASC NULLS LAST'
