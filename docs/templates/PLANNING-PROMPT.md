# Planning Prompt — TASK-XXX: <short title>

> Planner → Claude Code. **Step (1) of the build loop.** Asks for an Implementation
> Plan only. **Do NOT write code in response to this.**

Read `CLAUDE.md` and the references below, then return an Implementation Plan using
`docs/templates/IMPLEMENTATION-PLAN.md`.

## Task
- ID: `TASK-XXX`
- Module: `MXX — <name>` (`docs/05-MODULE-PLANNING.md`)
- Goal: <one or two sentences>

## Read these
- Specs: `docs/<…>.md §<…>`
- DB: `docs/04-DB-STRUCTURE.md` (models: <…>)
- Tests: `docs/08-TESTING.md` (likely types: <…>)
- UI (if applicable): `docs/11-UI-DEVELOPMENT.md §<page>` + drop `design/<surface>/<slug>/`

## Dependencies (must be DONE)
- `TASK-…`

## What the plan must cover
Files to touch · approach · interfaces/contracts · data/migration impact · the test
plan (types + cases) · risks · ordered steps · open questions.

## Constraints / guardrails to respect
Tenant scoping · money `BigInt` minor units · idempotency · no new paid dependency
without an ADR · stay within the module boundary.

> Return the plan only. After I review it I'll send a Build Request.
