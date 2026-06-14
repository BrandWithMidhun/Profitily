# Test Plan — TASK-XXX / MXX: <feature>

> Attach to a Build Request when testing is non-trivial. Mirrors the test types in
> `docs/08-TESTING.md`.

## Scope under test
<What behavior this plan covers.>

## Risks / what could break
- <risk → which test guards it>

## Test matrix
| Type | Tool | Cases | Where |
|---|---|---|---|
| Unit | Vitest | <cases> | `packages/…/__tests__` |
| Property | fast-check | <invariants> | `…` |
| Integration | Supertest + Testcontainers | <flows> | `apps/api/test/int` |
| Contract | Pact | <boundary> | `…/pact` |
| Component | RTL | <components> | `apps/web/…` |
| E2E | Playwright | <journeys> | `e2e/` |
| Isolation | Vitest/int | <tenant tables> | isolation suite |
| Idempotency | int | <replay> | `…` |
| a11y / visual / load / security | axe / Playwright / k6 / Semgrep+ZAP | <if any> | `…` |

## Fixtures / data
- Synthetic only. Fixed clock at <ISO time> for time-dependent math.
- Seed: <which seed/factory>.

## Coverage / quality target
- Lines/branches: <target> · Mutation (if core): ≥ 85%.

## Out of scope
- <explicitly not tested here, and why>
