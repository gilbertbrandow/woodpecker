"""Unit tests for table_query filter types — no DB or Flask context needed."""
from app.table_query import FilterList, DateFilter, RangeFilter


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
