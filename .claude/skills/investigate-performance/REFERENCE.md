# Performance Investigation — Reference

## Production constraints

Read `deploy/README.md` → **Services** and **Monitoring** sections before drawing conclusions. Key things that affect how you interpret latency numbers are documented there: instance type, Gunicorn worker/thread counts, Sentry sample rate, and the scaling path thresholds.

## Transaction → file mapping

| Transaction prefix | Route file | Service file |
|---|---|---|
| `dashboard.*` | `app/routes/dashboard.py` | `app/services/dashboard.py` |
| `leaderboard.*` | `app/routes/leaderboard.py` | `app/services/leaderboard.py` |
| `runs.*` | `app/routes/runs.py` | `app/services/run.py` |
| `training.*` | `app/routes/training.py` | `app/services/training.py` |
| `training_items.*` | `app/routes/training_items.py` | `app/services/training.py` |
| `auth.*` | `app/routes/auth.py` | `app/services/auth_service.py` |
| `users.*` | `app/routes/users.py` | — |

## Known patterns to look for

- **Bundled sub-requests**: a service calling another heavy service inline. If the frontend could fetch them in parallel, decoupling reduces P95 to `max(a, b)` instead of `a + b`.
- **Repeated context loading**: multiple functions each re-fetching the same rows the caller already loaded.
- **LATERAL joins with correlated subqueries**: powerful but can scan large tables per row if not indexed.
- **`COUNT(*)` with `EXISTS` subqueries**: common in status checks; can often be replaced with a single aggregating query.
