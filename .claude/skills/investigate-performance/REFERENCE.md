# Performance Investigation — Reference

## Production constraints

Read `deploy/README.md` → **Services** and **Monitoring** sections before drawing conclusions. Key things that affect how you interpret latency numbers are documented there: instance type, Gunicorn worker/thread counts, Sentry sample rate, and the scaling path thresholds.

## Transaction → file mapping

| Transaction prefix | Route file | Service file |
| --- | --- | --- |
| `dashboard.*` | `app/routes/dashboard.py` | `app/services/dashboard.py` |
| `leaderboard.*` | `app/routes/leaderboard.py` | `app/services/leaderboard.py` |
| `runs.*` | `app/routes/runs.py` | `app/services/run.py` |
| `training.*` | `app/routes/training.py` | `app/services/training.py` |
| `training_items.*` | `app/routes/training_items.py` | `app/services/training.py` |
| `auth.*` | `app/routes/auth.py` | `app/services/auth_service.py` |
| `users.*` | `app/routes/users.py` | — |

## Unavailable tools

**`pg_stat_statements` is not enabled.** It would provide 100% query coverage with accumulated call counts, mean/max execution times, and normalised query fingerprints — more complete than Sentry's 10% sample. It was not enabled because it requires a Postgres restart and adds a small but non-zero CPU overhead on the t3.micro.

If during an investigation you reach a point where Sentry spans + `db-explain` are insufficient to identify the root cause, say so explicitly in your report. The team can evaluate whether enabling `pg_stat_statements` is worth it for that specific investigation.

## Known accepted slowness

These have been investigated and deliberately left as-is. Don't re-flag them as new findings — note the current numbers and whether they've improved or regressed since the last investigation.

| Endpoint | Root cause | Why accepted | Next step if it regresses |
| --- | --- | --- | --- |
| `dashboard.get_dashboard` | Bundles leaderboard via `run_stats` CTE in `leaderboard.py:get_run_board()` — 2 EXISTS + 3 LATERAL subqueries per `run_training_item` row | Splitting into a separate request causes layout shift (leaderboard depends on `trainingId`/`runIndex` from the dashboard response, so fetches are inherently sequential). Composite index on `training_attempts(run_training_item_id, status, try_number)` added in #217 to reduce CTE cost. | Cache leaderboard result per `(schedule_id, run_index)` with invalidation on `complete_attempt` |

## Interpreting frontend signals

**Web vitals** (from `span.op:pageload` with `measurements.*`):

| Signal | High value points to |
| --- | --- |
| LCP (Largest Contentful Paint) | Bundle size, blocking resource load, or slow API fetch |
| TTFB (Time to First Byte) | Server processing time — corroborates backend P95 |
| FCP (First Contentful Paint) | JS parse/execute time or render-blocking resources |
| CLS (Cumulative Layout Shift) | Images without explicit dimensions, late-loading content |

High LCP with a fast backend → frontend bundle or resource issue, not the API. High TTFB alongside a slow backend → both are slow for the same root cause.

**`http.client` vs `http.server` gap**: the difference is network round-trip time. Sequential `http.client` spans within a single pageload trace (visible via distributed tracing) indicate waterfall fetches — the frontend waits for one response before starting the next. Parallelising them reduces P95 to `max(a, b)` instead of `a + b`.

## Interpreting EXPLAIN output

- **Sequential scan on a large table**: likely a missing index. Confirm with `db-index-stats` — high `seq_scan` with low `idx_scan` for that table.
- **Actual rows >> estimated rows**: planner misestimate, often from stale statistics (`ANALYZE <table>`) or a skewed data distribution.
- **High shared block reads vs hits**: data fetched from disk rather than memory — expected for infrequent queries, a concern for hot paths.

## Known patterns to look for

- **Bundled sub-requests**: a service calling another heavy service inline. If the frontend could fetch them in parallel, decoupling reduces P95 to `max(a, b)` instead of `a + b`.
- **Repeated context loading**: multiple functions each re-fetching the same rows the caller already loaded.
- **LATERAL joins with correlated subqueries**: powerful but can scan large tables per row if not indexed.
- **`COUNT(*)` with `EXISTS` subqueries**: common in status checks; can often be replaced with a single aggregating query.
