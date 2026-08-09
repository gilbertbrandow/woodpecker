---
name: sentry-scan
description: Scan all unresolved Sentry production issues for the Woodpecker project, filter out dev noise, group related issues, and return a prioritised list for further investigation. Does NOT read code, query the DB, or propose fixes. Use when the user asks to check Sentry, see what's broken in production, look at errors, or scan sentry issues.
---

# Sentry Scan

## Constants

- **Org slug**: `woodpecker-n0`
- **Region URL**: `https://de.sentry.io`

## Workflow

### 1. Fetch all unresolved production issues

```
search_issues(
  organizationSlug="woodpecker-n0",
  regionUrl="https://de.sentry.io",
  query="is:unresolved environment:production"
)
```

### 2. For each issue — measure production signal

```
search_events(
  organizationSlug="woodpecker-n0",
  regionUrl="https://de.sentry.io",
  dataset="errors",
  query="issue:<ISSUE-ID>",
  fields=["timestamp", "environment", "user.email", "release"],
  sort="-timestamp",
  limit=100,
  period="30d"
)
```

Count production vs development events. Flag any issue where the majority of events are development as **low-priority / likely dev noise** — note this explicitly.

### 3. Group related issues

For the remaining production-signal issues, group by:
- Same module or file
- Same error type (e.g. all `TypeError`, all `KeyError`)
- Same request path or Django view
- Same apparent symptom (e.g. all touch `accepted_moves`, all occur on the same endpoint)

Label each group with a short descriptive name.

### 4. Report

For each group (or ungrouped issue):

- **Error type** and short description
- **Production events** (last 30d) and unique users affected
- **First seen / last seen**
- **Related issues** in the same group and why they appear connected

Order by production impact (event count × user count).

Stop here. Do not read code, do not query the DB, do not propose fixes. Hand the prioritised list to `/sentry-bug` for deep investigation.
