---
name: Agent-Created Issue
about: Use when an AI agent creates or refines an issue for implementation handoff after clarifying behavior, scope, constraints, and acceptance criteria.
title: ""
labels: ""
assignees: ""
---

<!--
For the issue-creating agent:

- Interview the requester before creating or rewriting this issue.
- Ask clarifying questions until the desired outcome, scope, non-goals, acceptance criteria, and implementation constraints are clear.
- Do not create vague placeholder issues unless explicitly requested.
- Preserve important decisions from the interview, especially naming, sequencing, edge cases, tradeoffs, and what must stay unchanged.
- Prefer concrete behavior, examples, and edge cases over abstract intent.
- Inspect the codebase, related issues/PRs, and relevant docs when that would reduce ambiguity or prevent stale requirements.
- Make this issue stand on its own for a future implementation agent that will not have the original chat context.
- If something remains uncertain, say what is known, what is unknown, and what the implementing agent should investigate.
- Put non-blocking ideas in Follow-ups instead of Goals or Acceptance Criteria.
- Replace placeholder text with issue-specific content. If a section truly does not apply, write "Not applicable" with a short reason.
-->

## Context
- Related issues / PRs / docs / rough drafts:
- Why this issue exists now:
- Background the implementing agent must know:

## Desired outcome
_Describe the end state in plain language. What should be true when this issue is done?_

## Problem today
_Describe what is wrong, missing, risky, confusing, inconsistent, or too manual today._

## Goals
- _Concrete requirement_
- _Concrete requirement_
- _Concrete requirement_

## Non-goals
- _Explicitly out of scope_
- _Explicitly out of scope_
- _Explicitly out of scope_

## Expected behavior
### Primary behavior
- User-facing:
- API / backend:
- Developer / operator / pipeline:
- Behavior that must remain unchanged:
- Data / migration / deploy sequencing:

### Edge cases and failure modes
- _Important edge case_
- _Invalid or conflicting state_
- _Error handling / fallback / no-op behavior_

### Concrete examples
_Optional but strongly preferred when the issue changes API payloads, CLI commands, UI states, data flows, or migration behavior._

- Example request / response:
- Example UI or product state:
- Example command, import sequence, or deploy sequence:

## Technical notes
### Known constraints and architectural invariants
- `TrainingItem` is the generic item used by training flows.
- Source-specific data should live in source-specific tables.
- Source-specific solving behavior should be dispatched through service-layer logic, not scattered through routes.
- Before solving, the API should not reveal whether an item is a tactic, decoy, or positional exercise unless this issue explicitly changes that contract.
- Import / ingestion logic belongs in `pipeline/`, not the Flask backend.
- Migrations must be safe for fresh databases and existing production-like data.
- CI should stay meaningful; do not weaken checks to make changes pass.
- Add any issue-specific constraints here.

### Likely areas to inspect
- Frontend (`frontend/`):
- Backend (`backend/app/`, `backend/tests/`):
- Database / ORM / migrations (`backend/app/models/`, `backend/migrations/`):
- Pipeline (`pipeline/`):
- Docker / Compose / deploy (`docker-compose*.yml`, `deploy/`):
- CI / tooling (`.github/workflows/`, Makefiles, scripts):
- Docs:
- Security / auth / privacy concerns:

### Expected impact
- Frontend behavior:
- Backend behavior:
- API contract:
- Database schema / data migration:
- Pipeline / ingestion:
- Local development / Docker Compose:
- Deployment / release / downtime:
- CI / tests / tooling:
- Documentation:

## Questions answered during refinement
_Keep the important interview decisions here so the issue stands on its own._

- **Q:** _Question asked during refinement_
  - **A:** _Decision / answer_
- **Q:** _Question asked during refinement_
  - **A:** _Decision / answer_
- **Q:** _Question asked during refinement_
  - **A:** _Decision / answer_

## Questions for the implementing agent to investigate
_Open checks or codebase questions to verify before or during implementation. These are not acceptance criteria unless explicitly stated._

- [ ] _Open check or investigation item_
- [ ] _Open check or investigation item_
- [ ] _Open check or investigation item_

## Implementation checklist
> Suggested path only. This section is a recommended breakdown of work, not the definition of done.

- [ ] Inspect the current implementation and confirm the likely files, APIs, models, migrations, components, commands, docs, and workflows involved.
- [ ] Make the smallest coherent change set that satisfies the Goals.
- [ ] Preserve existing behavior outside the stated scope.
- [ ] Add or update tests close to the changed behavior.
- [ ] Update docs, commands, or operational references if behavior or workflow changes.
- [ ] Add issue-specific implementation steps here.
- [ ] _Concrete implementation step_
- [ ] _Concrete implementation step_

## Acceptance criteria
> Definition of done. These are the requirements reviewers should use to decide whether the issue is complete.

- [ ] _Observable outcome_
- [ ] _Observable outcome_
- [ ] _Observable outcome_

## Expected PR shape
- Preferred shape: _single PR / stacked PRs / investigation PR first / other_
- If split across multiple PRs, what belongs in each PR and in what order?
- If an investigation-only PR is expected first, what must it answer?
- Any migration, rollout, release, or downtime sequencing notes?
- Anything that must be called out explicitly in the PR description?

## Agent handoff
### Before coding
- Read this issue fully.
- Inspect the existing implementation before choosing an approach.
- Identify likely files, APIs, models, migrations, components, commands, docs, and workflows involved.
- Preserve existing behavior unless this issue explicitly says to change it.
- Do not broaden scope beyond the Goals and Acceptance Criteria.
- If anything remains ambiguous, document assumptions in the PR instead of silently guessing.

### During implementation
- Prefer small, coherent commits.
- Keep unrelated refactors out of the PR.
- Add or update tests close to the changed behavior.
- Update docs if setup, commands, architecture, or user-facing behavior changes.
- Do not weaken CI, remove checks, or hide failures to make the PR pass.

### Before handing off the PR
- Summarize implementation decisions and any deviations from the suggested checklist.
- List commands run.
- List manual testing performed.
- Call out known risks, tradeoffs, and follow-ups.

## Testing / verification
### Automated checks
- Backend:
- Frontend:
- Database / migration / pipeline:
- Other:

### Manual verification
- _User, maintainer, operator, or deploy flow to exercise_
- _User, maintainer, operator, or deploy flow to exercise_
- _Failure case or edge case to exercise_

### Commands to run
- Backend:
- Frontend:
- Pipeline / migration / deploy:
- Other:

## Review focus
_Tailor this to the issue. The defaults below are the minimum review lens for this repository._

- [ ] Does the PR solve the stated behavior rather than a nearby behavior?
- [ ] Does it preserve architecture boundaries and keep generic vs source-specific concerns in the right place?
- [ ] Are migrations safe for fresh databases and existing production-like data?
- [ ] Are backend responses and frontend assumptions aligned?
- [ ] Are pipeline responsibilities kept out of the Flask backend?
- [ ] Are docs, commands, and operational references updated where needed?
- [ ] Are there hidden production, deployment, data, security, or privacy risks?
- [ ] Were non-blocking ideas split into Follow-ups instead of folded into the PR?
- [ ] Add any issue-specific hot spots reviewers should scrutinize.

## Post-merge checklist
- [ ] No post-merge work is needed.
- [ ] Deployment or rollout sequencing is documented.
- [ ] Migration, backfill, or import steps are documented.
- [ ] Manual production verification steps are documented.
- [ ] Release note / changelog note is needed.
- [ ] Follow-up issue(s) should be created.

## Follow-ups
_Non-blocking future work only. If it must happen before merge, it is not a follow-up._

- _Possible follow-up_
- _Possible follow-up_
- _Possible follow-up_
