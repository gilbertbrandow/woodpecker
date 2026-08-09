---
name: sentry-bug
description: Deep root-cause investigation of a single Sentry issue for the Woodpecker project. Traces the full "why chain" from crash site to origin, verifies the hypothesis in production data via the DB tunnel, separates data bugs from code bugs, and reports the root cause with a suggested proof-by-test. Does NOT fix code, commit, or resolve issues. Use when the user names a specific Sentry issue to investigate, provides an issue ID or URL, or wants to know why a specific error is happening.
---

# Sentry Bug Investigation

## Constants

- **Org slug**: `woodpecker-n0`
- **Region URL**: `https://de.sentry.io`
- **DB tunnel**: `make -C deploy db-tunnel-start` (read-only; never run writes without explicit user confirmation)

## The core principle

The crash site is the crime scene, not the criminal. The goal is to trace the chain from the symptom back to the origin — data source, external input, or an explicit code decision that was wrong. Never propose a fix until that chain is fully traced and verified against production data.

## Workflow

### Step 1 — Find the issue

Accept an issue ID, URL, or plain description. If a description, search first:
```
search_issues(organizationSlug="woodpecker-n0", regionUrl="https://de.sentry.io", query="is:unresolved <description>")
```
Then fetch the full issue:
```
get_sentry_resource(url="https://woodpecker-n0.sentry.io/issues/<ID>")
```
If no issue is specified, ask the user before continuing.

### Step 2 — Production impact check

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

Count production vs development events. Note unique users affected and first/last seen. If the majority are development, flag as likely dev noise and pause to ask the user if they still want to proceed.

### Step 3 — Read culprit code

Use the stacktrace to locate the culprit file and line. Read the file and enough surrounding context to understand the full code path.

### Step 4 — Understand how the code was introduced

For the culprit file, check recent commit history:

```bash
git log -10 --oneline -- <culprit-file>
```

For any commit that looks relevant to the bug (touched the suspicious line, changed the data shape, added the code path), read the full diff and message:

```bash
git show <commit-sha>
```

Then find the PR the commit belongs to and read its description:

```bash
gh pr list --search "<commit-sha>" --state merged
gh pr view <number>
```

The goal is to understand **intent**: was this a known trade-off? Did the author anticipate this case? Does the PR description explain a constraint that makes the bug make sense? This feeds directly into the why chain — a bug introduced deliberately (but incorrectly) has a different fix than one introduced accidentally.

### Step 5 — Build the why chain (MANDATORY before any fix)

Answer each question in sequence. Do not move to step 6 until all are answered:

1. **Why did this error occur?** What value or state was wrong at the crash site?
2. **Why did that wrong value exist?** Where did it come from — a caller, a DB read, a config, an import?
3. **Why did it originate there?** Trace it back one more level.
4. Keep asking "why" until you reach a data source, an external input, or an explicit code decision.

**Guard rule**: if at any point you find yourself thinking "add a check / guard / fallback / default to handle this" — stop. A guard is not the fix; it is a signal you have not found the root cause yet. Ask: what is the correct behaviour when the invariant is violated? Is silently doing nothing actually correct?

### Step 6 — Verify hypothesis in production data (MANDATORY)

Before writing any code, confirm the hypothesis is actually true in production. Open the DB tunnel and query:

```bash
make -C deploy db-tunnel-start
```

Run `SELECT`, `COUNT(*)`, `jsonb_typeof`, or spot-check raw rows to confirm the bad state exists. Then check: **has this data path ever produced a correct outcome?** Look at attempt/event history (e.g. `training_attempts`, `source_import_runs`). If the answer is never, the problem is deeper than a guard.

**Never run `INSERT`, `UPDATE`, `DELETE`, or any DDL.** Read-only only. Ask the user before running any write.

### Step 7 — Separate data bug from code bug

For any error involving a value from the database, answer explicitly: is the code misreading good data, or is the data itself wrong? These have different fixes.

### Step 8 — State the root cause

Write one sentence in this form: "The root cause is X, which causes Y, which causes Z."

If you cannot write this sentence yet, return to step 5.

### Step 9 — Report

- **What**: the error in plain language
- **Where**: `file:line` crash site
- **Why chain**: the full traced chain from crash site to origin
- **Root cause**: the one sentence from step 8
- **Production impact**: event count, unique users, first/last seen
- **Data bug or code bug**: explicit answer from step 7
- **Confidence**: high / medium / low, and what would raise it if low
- **How to prove it**: suggest a targeted test that demonstrates the root cause — a test that fails against the current bad state and passes against the correct fix is the strongest form of proof before touching production code

### Step 10 — Architecture check

Before suggesting any fix direction, re-read `CONTEXT.md` to confirm the proposed approach fits the existing domain model and system design.

**Stop here.** Do not edit files, do not commit, do not resolve the issue in Sentry.
