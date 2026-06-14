# Build Request — TASK-XXX: <short title>

> The planner fills this and pastes it to Claude Code. The executor must satisfy every
> section before opening a PR. If anything is ambiguous, **stop and ask** before coding.

## 1. Goal
<One or two sentences: the outcome, in product terms.>

## 2. Context / references
- Module: `MXX — <name>` (`docs/05-MODULE-PLANNING.md`)
- Specs: `docs/<…>.md §<…>`
- Depends on (must be DONE): `TASK-…`
- Related code: `packages/…`, `apps/…`

## 3. Scope
**In scope**
- <bullet>
**Out of scope (do NOT build)**
- <bullet>

## 4. Interface / contract
- New/changed API routes (method, path, request, response shape):
- New/changed DB models or migrations:
- New/changed package exports (`packages/<…>`):
- Events emitted/consumed:

## 5. Acceptance criteria
- [ ] <observable, testable criterion>
- [ ] <…>

## 6. Test requirements (from `docs/08-TESTING.md`)
Tick what applies; each ticked item must exist and pass.
- [ ] Unit (Vitest)              — what:
- [ ] Property (fast-check)      — invariants:
- [ ] Integration (Testcontainers) — flows:
- [ ] Contract (Pact)            — boundary:
- [ ] Component (RTL)            — components:
- [ ] E2E (Playwright)           — journey:
- [ ] Tenant-isolation suite extended (if a tenant table is touched)
- [ ] Idempotency/replay (if webhook/sync)
- [ ] a11y / visual / load / security — if relevant:

## 7. Guardrails (must hold)
- Tenant queries scoped by `storeId`.
- Money as `BigInt` minor units; no floats; exact splits.
- No new paid dependency (else attach an ADR).
- Secrets via typed config; `.env.example` updated for new keys.

## 8. Deliverables
- Branch: `task/TASK-XXX-<slug>`
- Code + tests + doc updates (`docs/*`, `CLAUDE.md` if conventions change)
- PR using `docs/templates/PR-REVIEW.md`

## 9. Definition of done
All acceptance criteria met · all required tests green · `lint typecheck test build`
(+ `test:e2e`/`:int` where ticked) pass · docs updated · PR opened, not self-merged.
