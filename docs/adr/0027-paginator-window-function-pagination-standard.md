# Paginator object + window function as the standard for SQL pagination

All paginated raw-SQL endpoints use a `Paginator` dataclass (from `table_query.py`) instead of passing `page: int, page_size: int` as two separate ints. Services receive `paginator: Paginator`, merge `paginator.params` into their SQL params dict, include `COUNT(*) OVER() AS total_count` in the SELECT and `LIMIT :page_limit OFFSET :page_offset` at the end of the query, then call `paginator.paginate(rows, mapper)` to extract `(items, total)`. Routes obtain the object via `q.paginator`.

## Considered options

**Python-side slicing** (prior leaderboard pattern): load all rows, build the full list in Python, slice with `result[offset:offset+page_size]`. Correct but loads every row for every request — O(n) memory per page load.

**Two queries** (prior run/training pattern): a `SELECT COUNT(*)` with the same WHERE clause, then a paginated SELECT with LIMIT/OFFSET. Correct and efficient but duplicates the WHERE clause across two queries, creating a maintenance surface where they can drift.

**Window function** (chosen): `COUNT(*) OVER()` in the outer SELECT is evaluated by PostgreSQL over the full result set before LIMIT/OFFSET is applied, so a single query returns both the page slice and the accurate total. One query, no duplication, no drift risk.

## Consequences

- All service function signatures change from two int params to one `Paginator`. This is a broad but mechanical migration.
- ORM-based services (decoy, scraped_positional) use `paginator.page_size` and `paginator.page` directly in ORM calls; they do not use `paginator.paginate()` since ORM handles the count separately.
- `f`-string LIMIT/OFFSET interpolation (previously in `subset.py`, `schedule.py`) is eliminated — named params only.
