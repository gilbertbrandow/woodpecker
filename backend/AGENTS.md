# Backend Agent Guide

## Exception hierarchy

All user-facing errors must be raised as `AppError` subclasses from `app/exceptions.py`. Never use raw Python builtins for errors that map to HTTP responses.

| Class | HTTP | When to raise |
| ------- | ------ | --------------- |
| `ValidationError` | 422 | User-supplied input fails semantic validation |
| `NotFoundError` | 404 | A resource the user requested does not exist |
| `ConflictError` | 409 | The action conflicts with current resource state |
| `ForbiddenError` | 403 | The authenticated user lacks permission |

Both `title` and `detail` are required — no optional fields. `title` is the short label shown in the toast; `detail` is the user-facing sentence explaining what went wrong. Both are shown verbatim in the frontend.

```python
# Good
raise ValidationError("Name required", "Please provide a name for the subset.")
raise NotFoundError("Subset not found", "The requested subset does not exist.")
raise ConflictError("Already enrolled", "You are already enrolled in this schedule.")
raise ForbiddenError("Access denied", "You do not have permission to perform this action.")

# Wrong — do not use raw builtins for user-facing errors
raise ValueError("Name required")
raise LookupError("Not found")
```

The error handler in `app/errors.py` catches `AppError` and serialises it to `{"title": ..., "detail": ...}` with the correct status code. The 500 handler also uses this envelope shape so the frontend can always parse errors consistently.

## Error handler — do not modify without care

`app/errors.py` registers three handlers:

- `AppError` → `{"title": e.title, "detail": e.detail}` + `e.status_code`
- `HTTPException` (Werkzeug) → structured envelope + `e.code`
- Unhandled `Exception` → generic 500 envelope + logs via `app.logger.error`

Do not add `sentry_sdk.capture_exception()` calls anywhere in route handlers or services — `FlaskIntegration` captures unhandled exceptions automatically, and `AppError` subclasses are in `ignore_errors` so they are silently ignored by Sentry (they are expected domain errors, not bugs).

## Sentry

- **Captures:** unhandled exceptions (5xx) only — bugs, not domain errors
- **Ignores:** all `AppError` subclasses via `ignore_errors=[AppError]` in `sentry_sdk.init()`
- **User context:** set in a `before_request` hook via `sentry_sdk.set_user({"id": str(user_id)})`
- **Environment:** `FLASK_ENV` env var, defaults to `"production"`
- **DSN:** `SENTRY_DSN` env var — Sentry is fully disabled when unset (local dev default)

## Table endpoints

All server-paginated list endpoints parse their request with `TableQuery` from
`app/table_query.py`. Never read pagination or filter params via `request.args`
directly.

### Standard pattern

Routes are thin: parse → delegate to service → return JSON.

```python
# route
from app.table_query import TableQuery

@bp.get('/things')
@login_required
def list_things() -> Response:
    q = TableQuery(request)
    result = things_svc.list_things(
        page=q.page,
        page_size=q.page_size,
        search=q.q,
        user_ids=q.int_filter('userId'),
        status=q.str_filter('status'),
        created_at=q.date_filter('createdAt'),
        count=q.range_filter('count'),
        tag_ids=q.set_filter('tagIds'),
    )
    return jsonify(result)
```

Services build the query with `conditions` / `params` lists and call `.apply()`:

```python
# service
from app.table_query import FilterList, DateFilter, RangeFilter, SetFilter

def list_things(
    page: int, page_size: int, search: str | None,
    user_ids: FilterList, status: FilterList,
    created_at: DateFilter, count: RangeFilter, tag_ids: SetFilter,
) -> dict:
    conditions: list[str] = []
    params: dict[str, object] = {}

    if search:
        conditions.append('name ILIKE :search')
        params['search'] = f'%{search}%'

    user_ids.apply(conditions, params, 'things.user_id', prefix='uid')
    status.apply(conditions, params, 'things.status', prefix='st')
    created_at.apply(conditions, params, 'DATE(things.created_at)', prefix='ca')
    count.apply(conditions, params, 'things.count', prefix='cnt')
    tag_ids.apply(conditions, params, 'things.tag_ids', prefix='tags')

    where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''
    rows = db.session.execute(sa.text(
        f'SELECT * FROM things {where} ORDER BY created_at DESC'
        ' LIMIT :limit OFFSET :offset'
    ), {**params, 'limit': page_size, 'offset': (page - 1) * page_size}).all()
    total = db.session.execute(sa.text(f'SELECT COUNT(*) FROM things {where}'), params).scalar_one()
    return {'items': [...], 'total': total}
```

### `TableQuery` attributes and methods

| Member | Type | Purpose |
| ------ | ---- | ------- |
| `q.page` | `int` | Current page (1-based, clamped ≥ 1) |
| `q.page_size` | `int` | Rows per page (clamped 1–100) |
| `q.q` | `str \| None` | Full-text search string (from `?q=`) |
| `q.str_filter(key)` | `FilterList` | String enum / status filters (`multi` spec) |
| `q.int_filter(key)` | `FilterList` | Integer ID filters (`entity` spec) |
| `q.date_filter(key)` | `DateFilter` | Date/timestamp filters (`date` spec) |
| `q.range_filter(key)` | `RangeFilter` | Numeric range filters (`range` spec) |
| `q.set_filter(key)` | `SetFilter` | PostgreSQL array set-ops (`set` spec) |
| `q.flag(key)` | `bool` | One-off boolean toggles (`?key=true`) — not for table filter UI |

Every method returns a no-op object when the param is absent — always call
`.apply()` unconditionally; `apply` is a no-op when the filter has no value.

**`prefix` must be unique per call site** — it names the SQL bind params
(`:{prefix}_0`, `:{prefix}_from`, etc.). Two filters sharing a prefix will
collide and produce incorrect SQL.

## Services own errors, routes own HTTP

Business logic and all raises live in `backend/app/services/`. Route handlers only parse the request, call a service, and return JSON. A route handler that raises an `AppError` directly is a code smell.
