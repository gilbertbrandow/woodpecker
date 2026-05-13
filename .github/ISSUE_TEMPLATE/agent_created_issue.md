---
name: Agent-Created Issue
about: Use when an AI agent creates or refines an issue for implementation handoff.
title: ""
labels: ""
assignees: ""
---

<!--
Placeholder template for #11.

This template is intended for AI agents creating or refining GitHub issues through MCP.
It will be expanded after the researched template content is finalized.
-->

## Context

## Desired outcome

## Problem

## Goals

- [ ]

## Non-goals

-

## Expected behavior

## Technical notes

## Questions answered during refinement

- Q:
  A:

## Questions for the implementing agent to investigate

- [ ]

## Implementation checklist

- [ ]

## Acceptance criteria

- [ ]

## Expected PR shape

## Agent handoff

Before coding:

- Read this issue fully.
- Inspect the existing implementation before choosing an approach.
- Preserve existing behavior unless this issue explicitly says to change it.
- Do not broaden scope beyond the goals and acceptance criteria.

During implementation:

- Prefer small, coherent commits.
- Keep unrelated refactors out of the PR.
- Add or update tests close to the changed behavior.
- Update docs if setup, commands, architecture, or user-facing behavior changes.

Before handing off the PR:

- Summarize implementation decisions.
- List commands run.
- List manual testing performed.
- Call out known risks, tradeoffs, and follow-ups.

## Review focus

Reviewers should pay special attention to:

- Does the PR solve the stated behavior?
- Does it preserve the relevant architecture boundaries?
- Are migrations safe for existing data?
- Are backend responses and frontend assumptions aligned?
- Are docs and command references updated if needed?
- Are there hidden production, deployment, data, security, or privacy risks?

## Testing / verification

Expected automated checks:

- [ ]

Expected manual checks:

- [ ]

## Post-merge checklist

- [ ]

## Follow-ups

-
