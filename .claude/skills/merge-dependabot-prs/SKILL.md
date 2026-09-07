---
name: merge-dependabot-prs
description: Autonomously process all open Dependabot PRs — fix failing CI, approve, and merge to main without interrupting the user. Use when asked to "merge dependabot PRs", "process dependabot", "clear dependabot queue", or /merge-dependabot-prs.
---

# Merge Dependabot PRs

Work through every open Dependabot PR autonomously. Fix what you can, approve and merge everything that's safe. Only stop when you genuinely cannot determine whether production will break.

## Step 1 — Fetch and triage

```bash
gh pr list --author app/dependabot --state open \
  --json number,title,labels,headRefName,statusCheckRollup
```

Classify each PR:

| Bucket | Criteria |
|---|---|
| **Green** | All checks `COMPLETED` with `SUCCESS` |
| **Needs fix** | At least one check `FAILURE` or `ERROR` |
| **Pending** | Any check still `status != "COMPLETED"` |

The `major-version` label is informational — note it but do not treat it as a blocker on its own. A major bump with green CI and a clearly scoped changelog is fine to merge.

## Step 2 — Green PRs: approve and merge immediately

```bash
gh pr review <PR_NUMBER> --approve --body "CI is green — approving."
gh pr merge <PR_NUMBER>
```

No confirmation needed. Repeat for every green PR.

## Step 3 — Needs-fix PRs: diagnose, fix, then merge

For each failing PR:

1. Fetch the failure logs:
   ```bash
   gh run list --branch <HEAD_REF> --limit 5 --json databaseId,status,conclusion,workflowName
   gh run view <RUN_ID> --log-failed
   ```

2. Read the error carefully. Categorise it:

   **Lockfile drift** — the `dependabot-lockfile.yml` workflow should have handled this automatically. Check if it ran and failed:
   ```bash
   gh run list --branch <HEAD_REF> --workflow dependabot-lockfile.yml --limit 5
   ```
   If it failed, investigate and fix the workflow itself rather than regenerating the lockfile manually.

   **Type errors or test failures** — check out the branch, read the error, look at what the new package version changed (changelog / release notes), apply the minimal fix, run local checks if practical:
   ```bash
   git fetch origin <HEAD_REF> && git checkout <HEAD_REF>
   # frontend: cd frontend && make lint && make test
   # backend:  cd backend && make lint && make test
   git commit -m "fix: migrate <package> usage to v<VERSION> API"
   git push
   ```
   Then wait for CI to rerun and merge when green.

   **Build failure** — treat like type errors above.

   **Unrelated flake** — if the failure is clearly unrelated to what the PR changed (e.g. a backend check failing on a frontend-only bump), note this in the merge comment and merge anyway.

3. After fixing, wait for CI, then approve and merge.

## Step 4 — When to stop and ask

Stop and surface to the user **only if**:

- The fix requires changes across many files and you are not confident the behaviour is preserved.
- The new package version has known regressions or removes APIs that are used in ways you cannot fully trace.
- CI passes but you found something in the changelog (security advisory, behaviour change) that production traffic could hit.
- CI is still failing after your fix attempt.

In those cases, summarise: what the PR upgrades, what specifically concerns you, and what you already tried. Then ask how the user wants to proceed.

## Step 5 — Pending PRs

If any PR has checks still running, skip it and report which ones remain, so the user can re-run the skill later.

## After all PRs

Print a short summary: how many were merged, how many were fixed-then-merged, any that were skipped and why.
