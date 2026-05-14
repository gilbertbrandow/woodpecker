# Fix Dependabot PR

Diagnose and fix a failing dependabot pull request. Handles lockfile drift, breaking API changes, and dependencies that are too breaking to upgrade now.

## Arguments

`$ARGUMENTS` is an optional PR number. If empty, list failing dependabot PRs and ask the user which one to work on.

---

## Step 1 — Identify the PR

If `$ARGUMENTS` is empty:

- Run `gh pr list --author app/dependabot --state open --json number,title,headRefName,statusCheckRollup` to list open dependabot PRs.
- Filter to PRs where at least one required status check has failed (look for `FAILURE` or `ERROR` in `statusCheckRollup`).
- Show the user a numbered list: PR number, title, and which checks are failing.
- Ask the user which PR to work on. Stop and wait for their reply.

If a PR number was given, proceed directly with that PR number.

---

## Step 2 — Gather context

Run these commands (in parallel where possible):

```bash
gh pr view <PR_NUMBER> --json number,title,headRefName,body,baseRefName
gh run list --branch <HEAD_REF> --limit 5 --json databaseId,status,conclusion,workflowName
```

Note the branch name (`headRefName`). Note which CI jobs failed.

For each failed job, fetch the failure output:

```bash
gh run view <RUN_ID> --log-failed
```

Read the failure output carefully. Identify the root cause before doing anything.

---

## Step 3 — Categorise the failure

Decide which category applies:

### A — Lockfile drift

Symptoms: `npm ci` fails with `Missing: <package>@<version> from lock file` or similar.

This should be rare — the `dependabot-lockfile.yml` workflow regenerates the lockfile automatically. If it still happens, the workflow may not have run yet or failed itself.

Fix: see **Fix A** below.

### B — Type errors or test failures

Symptoms: `tsc` or `vitest` or `pytest` or `mypy` fails with specific errors caused by the bumped package.

The new version has API changes that break existing code. This may or may not be fixable quickly.

Fix: see **Fix B** below.

### C — Build failure

Symptoms: Docker build or Vite build fails.

Treat like B — investigate the specific error before acting.

### D — Unrelated failure

Symptoms: The failure is in a job unrelated to what dependabot changed (e.g., a backend test failing on a frontend-only PR).

Note this to the user. The PR itself may be fine — the failing check might be a pre-existing flake or unrelated regression. Do not close the PR. Explain and stop.

---

## Fix A — Lockfile drift

Check out the branch locally:

```bash
git fetch origin <HEAD_REF>
git checkout <HEAD_REF>
```

Regenerate the lockfile:

```bash
cd frontend && npm install
```

Commit and push:

```bash
git add frontend/package-lock.json
git commit -m "chore: regenerate package-lock.json for dependabot branch"
git push
```

Tell the user CI should now pass and they can re-run the failed jobs if needed.

---

## Fix B — Type errors or test failures

Check out the branch:

```bash
git fetch origin <HEAD_REF>
git checkout <HEAD_REF>
```

Read the exact error messages from the CI log. Then:

1. Look at what changed in the PR — which package was bumped and from which version to which.
2. Check if the package has a changelog, migration guide, or release notes:
   - For npm: `gh api https://registry.npmjs.org/<package>` or search npm for the package changelog.
   - For pip: PyPI or the project's GitHub releases page.
3. Read the failing files in the codebase to understand what needs updating.

Apply the minimal fix required to make CI pass. Do not refactor unrelated code.

After making changes, run the appropriate checks locally if possible:

- Frontend: `cd frontend && make lint && make test`
- Backend: `cd backend && make lint && make test`

Commit any fixes with a clear message:

```bash
git commit -m "fix: migrate <package> usage to v<NEW_VERSION> API"
git push
```

Tell the user what you changed and why, so they can review before the PR is merged.

---

## Too Breaking — when a quick fix is not possible

A dependency upgrade is **too breaking** when any of these are true:

- The new major version removes APIs used extensively across the codebase and migrating would require large, risky refactors.
- The new version has known regressions or is not yet stable.
- Fixing the type errors would require changing behaviour, not just call signatures.
- The fix would touch more than a handful of files and you are not confident the changes are correct.

When this applies, **do not attempt a partial fix**. Instead:

1. Explain clearly to the user:
   - What the package is and what version it jumped to.
   - What specifically is breaking (quote the CI errors).
   - Why a quick fix is not feasible.

2. Present these options and ask which to take:

   **Option 1 — Pin to the previous working version**
   Update `package.json` (or `requirements.txt`) to pin to the last known-good version and regenerate the lockfile. Push to the PR branch or create a new commit on main. This stops dependabot from re-opening the same PR immediately.

   **Option 2 — Close the PR with a comment**

   ```bash
   gh pr close <PR_NUMBER> --comment "Closing: this upgrade is too breaking to apply without a dedicated migration. The package has been pinned to the previous version in the codebase until a proper migration can be planned."
   ```

   Then pin the version in the codebase on the current branch.

   **Option 3 — Leave it open and create a tracking note**
   Leave the PR open but add a comment explaining why it cannot be merged yet:

   ```bash
   gh pr comment <PR_NUMBER> --body "This upgrade requires a migration that is out of scope for an automated fix. Leaving open as a reminder. Do not merge until the migration is complete."
   ```

3. Wait for the user to choose. Carry out the chosen option. Do not merge anything without explicit user confirmation.

---

## Always confirm before pushing or closing

Before pushing commits or closing a PR, briefly summarise what you are about to do and ask the user to confirm. This is a shared repository and these actions are visible to others.
