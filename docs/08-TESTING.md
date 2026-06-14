# 08 — Testing Strategy (All Automation Testing)

> Goal: catch defects cheaply and keep the **profit math provably correct**. Every
> tool below is **open-source** (aligned with the cost philosophy). Tests are the
> definition of done — a Build Request states which of these apply, and the executor
> must satisfy them before review.

## 1. The pyramid (where effort goes)

```
        ╱╲          E2E (Playwright) — few, critical user journeys
       ╱──╲         Contract (Pact) — every external + internal API boundary
      ╱────╲        Integration (Supertest + Testcontainers) — API + real PG/Redis/MinIO
     ╱──────╲       Component (React Testing Library) — UI units
    ╱────────╲      Unit + Property (Vitest + fast-check) — bulk; all of packages/core
   ╱──────────╲     Static (TS strict, ESLint, Semgrep, type/lint gates)
```
Plus cross-cutting suites: **load (k6)**, **security (SAST/DAST/deps/secrets)**,
**accessibility (axe)**, **mutation (Stryker)**, **visual regression (Playwright)**,
**migration**, **multi-tenant isolation**, **idempotency/replay**.

## 2. Test types, tools, and scope

### 2.1 Static analysis (every commit, fastest gate)
- **TypeScript strict** (`tsc --noEmit`) — type safety.
- **ESLint** + `eslint-plugin-security` — lint + insecure-pattern detection.
- **Prettier --check** — formatting.
- Fails the build on any error.

### 2.2 Unit tests — **Vitest**
- Cover all pure logic, **100% on `packages/core`** (Money, profit, shipping rules,
  allocation, opex, roll-ups). Fast, no I/O, run on every change.
- Also: NestJS providers/services with mocked deps; util functions; zod schemas.

### 2.3 Property-based tests — **fast-check**
- For the engine's invariants over randomized valid inputs:
  - integer splits always sum to the whole,
  - roll-ups reconcile to the paise (`variant Σ = product = store`),
  - `profit = revenue − Σcosts` always holds,
  - shipping rule resolution is deterministic.
- Catches edge cases golden tests miss (rounding, empty orders, huge values).

### 2.4 Integration tests — **Supertest + Testcontainers**
- Spin up **real** Postgres+Timescale, Redis, MinIO in ephemeral containers; run API
  routes and workers against them. No mocking the DB.
- Cover: CRUD + temporal cost resolution, CSV import, webhook→persist pipeline,
  backfill resume, DLQ/retry, snapshot writing, report generation (→ MinIO),
  notification delivery (→ Mailpit).

### 2.5 Contract tests — **Pact** (+ JSON-schema checks)
- **Consumer side:** our `integrations/*` clients pin the shape of Shopify / Shiprocket
  / Meta / Google / TikTok responses so a provider change is caught fast.
- **Internal:** `apps/web` ↔ `apps/api` request/response contracts so frontend and
  backend can't drift.

### 2.6 Component tests — **React Testing Library** (in Vitest)
- Dashboard widgets, wizard steps, forms: render, interaction, state, error/empty/
  loading states. No real network (mocked query client).

### 2.7 End-to-end tests — **Playwright**
- A handful of critical journeys against a seeded stack: install→wizard→dashboard,
  add product cost (CSV)→see profit, create shipping rule→preview, drill-down
  Store→Order, ask an AI agent. Runs headless in CI.

### 2.8 Visual regression — **Playwright screenshots**
- Snapshot key dashboard views and the profit waterfall; diff on PRs to catch
  unintended UI shifts. (OSS; no paid visual-testing SaaS.)

### 2.9 Accessibility — **axe-core via Playwright**
- Automated WCAG checks on main pages (contrast, roles, labels, keyboard). Fails CI on
  new serious violations.

### 2.10 Load & performance — **k6**
- Scenarios: dashboard read API (assert **p95 < 2s** on a 50k-order seed), ingestion
  throughput (orders/sec the worker sustains), AI endpoint under concurrency. Run
  nightly + before release, not on every PR.

### 2.11 Security testing (OSS only)
- **SAST:** Semgrep + (optionally) CodeQL — code-level vulns.
- **Dependency scanning:** `npm audit` + **OSV-Scanner**; Dependabot/Renovate PRs.
- **Secret scanning:** **Gitleaks** in CI + pre-commit.
- **DAST:** **OWASP ZAP** baseline scan against the running app (auth flows, headers,
  injection) — in Phase 8 and nightly.
- **Authz/tenant tests:** dedicated suite (see §3).

### 2.12 Mutation testing — **Stryker**
- Runs on `packages/core` (and other critical logic) to measure test *quality*: it
  mutates code and checks tests fail. **Target mutation score ≥ 85%** on core. Gaps =
  add tests, not lower the bar. Heavy → nightly / pre-release.

### 2.13 Database migration tests
- Apply migrations from a clean DB **and** on top of a seeded prior version; assert
  schema + a data round-trip. Guards against broken/destructive migrations.

## 3. Cross-cutting mandatory suites

### Multi-tenant isolation (sev-1)
A standing suite that, for every tenant table, asserts queries scoped to store A
**never** return store B's rows, and that the tenant guard throws on unscoped access.
**Extend it whenever a tenant table is added** — it's part of the acceptance criteria.

### Idempotency / replay
For every webhook + sync job: deliver the same event twice and assert exactly one
effect (one row, one job, balances unchanged). Backfill: interrupt mid-run, resume,
assert no duplicates.

### AI grounding & injection
Assert agents return **engine-computed** numbers (not hallucinated), the router
escalates only past threshold and caches, and that adversarial prompts in merchant
data cannot make an agent take destructive actions or leak another tenant's data.

## 4. Coverage & quality targets
| Area | Target |
|---|---|
| `packages/core` line/branch coverage | 100% |
| `packages/core` mutation score | ≥ 85% |
| API services (overall) | ≥ 80% |
| Critical E2E journeys | all green, no flakes |
| Tenant-isolation suite | 100% of tenant tables covered |

Coverage thresholds are enforced in `vitest.config` and fail CI if breached.

## 5. CI wiring (GitHub Actions)
| Stage | Runs on | Includes |
|---|---|---|
| **PR (required)** | every PR | static, unit, property, integration (Testcontainers), contract, component, secret scan, dependency audit, SAST, affected E2E |
| **Nightly** | schedule | full E2E, visual regression, a11y, load (k6), mutation (Stryker), DAST (ZAP) |
| **Pre-release** | tag | everything + migration tests on a prod-like snapshot |

Turborepo runs only **affected** packages' tests on PRs for speed; nightly runs all.

## 6. Local commands
```bash
pnpm test            # unit + property + component (fast)
pnpm test:int        # integration (Testcontainers)
pnpm test:contract   # Pact
pnpm test:e2e        # Playwright (needs seeded stack up)
pnpm test:a11y       # axe via Playwright
pnpm test:load       # k6
pnpm test:mutation   # Stryker
pnpm test:sec        # Semgrep + gitleaks + npm audit + osv-scanner
pnpm test:all        # everything (CI nightly parity)
```

## 7. Conventions
- **Deterministic, isolated, parallel-safe** — each test sets up its own tenant/data;
  no shared mutable state; fixed clock for time-dependent math.
- **Synthetic data only** — never real merchant PII in fixtures.
- **One assert-theme per test**; descriptive names (`computeOrderProfit > refunds in
  later period reduce that period`).
- **No flaky E2E** — quarantine and fix; a flaky test is a failing test.
- New behavior ships with tests in the **same PR**; bug fixes ship with a regression
  test that fails before the fix.
