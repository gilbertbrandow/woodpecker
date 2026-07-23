---
name: sentry
description: Investigate production Sentry issues for the Woodpecker project and report findings. Use when the user asks to check Sentry, look at errors, or investigate a bug. Fetches issues, filters to production-only events, reads relevant code, and returns a plain-language report. Does NOT fix code, commit, or resolve issues.
---

# Sentry

## Constants

- **Org slug**: `woodpecker-n0`
- **Region URL**: `https://de.sentry.io`

## Workflow

### 1. Fetch production issues

```
search_issues(
  organizationSlug="woodpecker-n0",
  regionUrl="https://de.sentry.io",
  query="is:unresolved environment:production"
)
```

### 2. For each issue — break down events by environment

```
search_events(
  organizationSlug="woodpecker-n0",
  regionUrl="https://de.sentry.io",
  dataset="errors",
  query="issue:WOODPECKER-BACKEND-X",
  fields=["timestamp", "environment", "server_name", "release"],
  sort="-timestamp",
  limit=100,
  period="30d"
)
```

Count how many events are `environment:production` vs `environment:development`. If the majority are dev, the issue is likely local noise rather than a real production problem — note this clearly.

### 3. Get full issue details

```
get_sentry_resource(url="https://woodpecker-n0.sentry.io/issues/WOODPECKER-BACKEND-X")
```

Focus on: stacktrace, culprit file/line, HTTP request, user impact.

### 4. Read relevant code

Use the stacktrace to locate the culprit in the codebase. Read the file and surrounding context to understand what the code is doing and why it might fail.

### 5. Return a report to the user

For each issue, report:

- **What**: the error in plain language
- **Where**: file and line where it originates
- **Why**: the root cause based on code + event data
- **Production impact**: how many real production events, which users affected
- **Confidence**: whether you are confident you understand the fix, or whether more investigation is needed

Stop here. Do not edit files, do not commit, do not resolve issues in Sentry.
