---
name: investigate-performance
description: Investigate API performance for the Woodpecker project and produce a ranked findings report. Use when the user asks about slow requests, performance issues, latency, why something feels slow, or wants to know where to focus optimisation efforts. Fetches real P95/count data from Sentry, drills into SQL spans, runs EXPLAIN ANALYZE on slow queries via the DB tunnel, reads relevant code, and ranks findings by actual impact. Does NOT fix code or commit anything.
---

# Performance Investigation

## Sentry constants

- **Org**: `woodpecker-n0` · **Region**: `https://de.sentry.io` · **Filter**: `environment:production`

## Step 1 — Fetch latency by endpoint

```
search_events(
  organizationSlug="woodpecker-n0",
  regionUrl="https://de.sentry.io",
  dataset="spans",
  query="environment:production span.op:http.server",
  fields=["transaction", "avg(span.duration)", "p75(span.duration)", "p95(span.duration)", "count()"],
  sort="-p95(span.duration)",
  period="30d",
  limit=25
)
```

## Step 2 — Rank by impact

Primary sort: **P95 × count** — a 150 ms endpoint called 1 400 times matters more than an 800 ms endpoint called 10 times.

Exception: flag any endpoint with P95 > ~1 s regardless of call count. A rarely-used endpoint that takes 3 s is still a bad user experience and often signals a missing index or a runaway query that will get worse as data grows. Note both dimensions explicitly in the report.

## Step 3 — Drill into SQL spans for slow endpoints

For each high-impact endpoint, fetch its DB spans to find slow queries:

```
search_events(
  organizationSlug="woodpecker-n0",
  regionUrl="https://de.sentry.io",
  dataset="spans",
  query="environment:production transaction:<name> span.op:db",
  fields=["span.description", "avg(span.duration)", "p95(span.duration)", "count()"],
  sort="-p95(span.duration)",
  period="30d",
  limit=20
)
```

## Step 4 — Get DB context

All `db-*` targets default to `ENV=prod` (production via SSH tunnel). The tunnel must be open first: `make -C deploy db-tunnel-start`.

Before explaining specific queries, get the full picture of table sizes and index health:

```bash
make -C deploy db-table-sizes ENV=prod   # row counts + disk size per table
make -C deploy db-index-stats ENV=prod   # seq_scan vs idx_scan per table — high seq_scan = likely missing index
```

Use `db-table-sizes` to contextualise EXPLAIN output — a sequential scan on 500 rows is fine; on 500 000 rows it is not. Use `db-index-stats` to spot tables being scanned heavily without index use, even before you know which specific queries are slow.

Then for any SQL span averaging > 50 ms, run `EXPLAIN ANALYZE`:

```bash
make -C deploy db-explain SQL="SELECT ..." ENV=prod
```

Look for: sequential scans on large tables, actual rows far exceeding estimated rows (planner misestimate), shared block reads vs hits (disk vs memory).

## Step 4b — Drill into individual slow traces

Aggregate P95 shows an endpoint is slow. A single trace shows the exact query waterfall — how many DB calls, in what order, and whether they're sequential when they could be parallel. Find a slow trace ID from the Sentry Performance tab, then:

```
get_sentry_resource(url="https://woodpecker-n0.sentry.io/performance/trace/<trace-id>/")
```

This is especially useful for spotting N+1 patterns (many small queries in sequence) and bundled sub-requests that inflate wall time.

## Step 5 — Read the code

Map each transaction name to its route and service file (e.g. `dashboard.get_dashboard` → `app/routes/dashboard.py` + `app/services/dashboard.py`). Read the full service function to identify:

- Redundant queries (same data fetched twice)
- N+1 patterns (query inside a loop)
- Expensive calls bundled into one response that could be parallelised
- Missing result reuse across sub-functions called in sequence

See [REFERENCE.md](REFERENCE.md) for production constraints to keep in mind while reading the code.

## Step 6 — Report

Present findings as a ranked list. For each item:

- **Endpoint** and its P95 / avg / call count
- **Root cause** with file:line reference
- **Why it's slow** in concrete terms (e.g. "re-fetches runs table already loaded by caller", "bundles leaderboard query adding 450 ms worst-case")
- **Potential fix** in one sentence
- **Confidence** — high / medium / low based on how clearly the cause shows in the code

Stop here. Do not edit files, do not commit, do not open PRs.
