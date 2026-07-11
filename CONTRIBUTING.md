# Contributing to Woodpecker

Thanks for your interest in contributing. This document covers how to report bugs,
suggest features, and submit code changes.

## Reporting bugs

Before filing a new issue, search existing issues to avoid duplicates.

A good bug report includes:

- Steps to reproduce — the minimal sequence that triggers the problem
- Expected behaviour and what you saw instead
- Browser / OS if it is a UI issue
- Any console errors or screenshots that help pin it down

## Suggesting features

Open a GitHub issue and describe the problem you are trying to solve rather than
jumping straight to a solution. Framing it as a problem leaves room for discussion
about the best approach. If you are unsure whether the idea fits the project, open
a discussion first.

## Contributing code

### Development setup

See [README.md](README.md) for prerequisites and the full local setup.

### Branch and commit workflow

1. Fork the repo and create a branch from `main`.
2. Keep branches focused — one feature or bug fix per branch.
3. Write a clear commit message that explains *why* the change was made, not just what.
4. Open a pull request against `main` when the work is ready to review.

### Pull requests

- Fill in the [PR template](.github/pull_request_template.md) fully.
- Test the happy path locally before marking the PR ready.
- Keep diffs small and reviewable. A large PR is harder to merge and easier to break.

### Code style and linting

Run the full linter suite before pushing:

```bash
make lint
```

This runs ruff + mypy (backend), ESLint + TypeScript (frontend), ruff (pipeline),
and markdownlint across all Markdown files. CI runs the same checks — a red lint job
will block the PR.

New backend logic should have tests. Run them with:

```bash
make test              # unit tests
make test-integration  # integration tests (spins up a test DB)
```

### Domain language

This project has a precise domain vocabulary. Before writing code or issue comments,
read [CONTEXT.md](CONTEXT.md). Using the canonical terms (e.g. **TrainingItem**,
**Run**, **Subset**, **Schedule**) rather than informal synonyms keeps code, issues,
and reviews unambiguous.
