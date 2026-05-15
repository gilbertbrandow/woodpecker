# Agent Guide

This repo has three main code areas:

- `backend/` — Flask, SQLAlchemy, Alembic, PostgreSQL.
- `frontend/` — React, TypeScript, Vite.
- `pipeline/` — data import and source ingestion.

Project-specific agent skills live in `.claude/skills/`.

## Agent skills

### Issue tracker

GitHub Issues for `gilbertbrandow/woodpecker`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to GitHub labels (`needs-triage`, `question`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — `CONTEXT.md` at root, `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.
