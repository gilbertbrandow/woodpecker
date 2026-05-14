---
name: prepare-issue
description: Prepare to work on a GitHub issue by creating a branch, reading issue context and comments, inspecting relevant code, asking clarifying questions, and stopping before implementation.
---

# Prepare Issue

Prepare to work on a GitHub issue without implementing it yet.

The goal of this skill is to create a clean branch, understand the issue deeply, inspect the relevant code, ask useful clarifying questions, and then stop. The output of this skill is shared understanding, not code.

## Arguments

The argument is required and must be a GitHub issue number.

If no issue number is provided, ask the user for an issue number and stop.

---

## Step 1 — Fetch the issue

Fetch the issue and its comments:

```bash
gh issue view <ISSUE_NUMBER> --json number,title,body,state,labels,assignees,comments,url
```

Read the issue title, description, labels, assignees, and all comments carefully.

If the issue is closed, tell the user it is closed and ask whether to continue. Stop and wait for their reply.

Do not edit the issue body, labels, assignees, or state unless the user explicitly asks.

---

## Step 2 — Create a branch

Create a branch from the latest `main`.

Derive the branch name from the issue number and title:

```text
<issue-number>-<short-kebab-title>
```

Examples:

```text
84-refactor-pipeline-metadata
87-standardize-source-detail-pages
```

Use a short, readable branch name. If the title is long, keep only the most important words.

Run:

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b <BRANCH_NAME>
```

If a suitable branch already exists, check it out instead of creating a duplicate.

---

## Step 3 — Link the branch from the issue

After the branch has been successfully created or checked out, comment on the issue with the branch name.

Use a comment like:

```md
Starting issue preparation on branch:

```text
<BRANCH_NAME>
```

I will read the issue/comments, inspect the relevant code, and come back with clarifying questions before implementation.
```

Do not open a pull request yet.

---

## Step 4 — Read related context

Read the issue again and identify referenced issues, pull requests, files, commands, or docs.

If the issue body or comments mention related issues or PRs, inspect the most relevant ones.

Useful commands:

```bash
gh issue view <ISSUE_NUMBER> --comments
gh issue view <RELATED_ISSUE_NUMBER> --comments
gh pr view <PR_NUMBER> --json number,title,body,files,comments,mergedAt,url
```

Do not recursively follow every link forever. Focus on context that directly affects the current issue.

Take notes on:

- the desired outcome
- explicit goals
- explicit non-goals
- acceptance criteria
- decisions already made
- open questions
- likely implementation areas
- risks or edge cases

---

## Step 5 — Inspect the codebase

Inspect the code before asking broad questions.

Use the issue context to search for relevant files, functions, routes, models, components, tests, Makefile targets, docs, migrations, or pipeline commands.

Prefer targeted searches first. Examples:

```bash
rg "TrainingItem|RunTrainingItem|TrainingAttempt"
rg "sources|lichess-tactics|Source"
rg "pipeline_runs|pipeline|lichess_tactics"
rg "<keyword from issue>"
```

Read enough code to understand the current implementation shape before reporting back.

Do not start implementation.

Do not make code changes.

Do not create commits.

---

## Step 6 — Grill the user where clarification is needed

After reading the issue, comments, and relevant code, identify what is still ambiguous.

Ask targeted questions that help clarify:

- product behavior
- expected user/developer/operator flow
- edge cases
- non-goals
- migration or deployment constraints
- testing expectations
- expected PR shape
- whether to split the work
- risky architectural decisions

Keep questions grounded in what you found in the codebase. Avoid generic questions that the issue already answers.

If the issue is already clear, say so and list the assumptions you will use later.

---

## Step 7 — Report back and stop

Report back to the user with a concise preparation summary.

Include:

- issue number and title
- branch name
- issue status
- related issues/PRs inspected
- relevant files or areas inspected
- your current understanding of the desired outcome
- likely implementation areas
- risks or edge cases noticed
- clarifying questions, if any

End by making it clear that implementation has not started yet.

Example final response:

```text
Prepared issue #87 on branch `87-standardize-source-detail-pages`.

I read the issue, comments, related #78 and #84 context, and inspected the current Sources frontend/backend implementation.

My understanding is ...

Likely areas:
- frontend/src/pages/...
- frontend/src/components/sources/...
- backend/app/routes/sources.py

Questions before implementation:
1. ...
2. ...

I have not started implementation yet.
```

Stop and wait for further instructions.

---

## Guardrails

Do not implement code during this skill.

Do not commit code during this skill.

Do not push code changes other than creating/checking out the preparation branch.

Do not open a pull request.

Do not close issues or pull requests.

Do not merge anything.

Do not edit issue descriptions unless explicitly instructed.

Do not mark work complete.

The only GitHub write action this skill should normally perform is commenting on the issue with the prepared branch name.
