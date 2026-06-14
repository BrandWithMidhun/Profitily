# Implementation Plan — TASK-XXX: <title>

> Claude Code → Planner. **Step (2).** No code yet — this is the plan for review.

## Understanding of the goal
<Restate the goal in your own words to confirm alignment.>

## Approach
<How you'll implement it, in a few sentences. Key design choices.>

## Files to create / change
| Path | Create/Change | Purpose |
|---|---|---|
| `packages/…` | create | <…> |
| `apps/api/…` | change | <…> |

## Interfaces / contracts
- API routes (method, path, request, response):
- Package exports:
- DB models / migrations (incl. Timescale step if any):
- Events emitted/consumed:

## Test plan (from `docs/08-TESTING.md`)
| Type | Tool | Cases |
|---|---|---|
| Unit | Vitest | <…> |
| Property | fast-check | <invariants> |
| Integration | Testcontainers | <flows> |
| Contract / Component / E2E / a11y / load / isolation / idempotency | <tool> | <if applicable> |

Coverage/mutation target: <…>

## Data / migration impact
<New tables, columns, indexes, backfill, reversibility.>

## Risks & mitigations
- <risk → mitigation>

## Ordered steps
1. <…>
2. <…>

## Security & simplicity check
- Security touchpoints (`docs/13`) this task affects: <input validation / token
  handling / authz / webhook verify / none> → how handled.
- Simplicity (`docs/14`): confirm the approach is the simplest that meets the criteria;
  note anything you deliberately did **not** build.

## Flags / open questions (blocking)
List anything ambiguous, conflicting, risky, or outside the spec. **Raise each as a
flag (`docs/templates/FLAG.md`) and do not proceed past it without a planner decision.**
- <none / flag #1 …>

