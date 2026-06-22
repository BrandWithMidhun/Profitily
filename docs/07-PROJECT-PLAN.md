# 07 — Project Plan (Execution Board)

> The **planner** maintains this. Each task = one Claude Code Build Request / branch /
> PR. Statuses: `TODO · DOING · REVIEW · DONE · BLOCKED`. Every feature task carries
> its **test requirements** (see `docs/08-TESTING.md`). Executor works the lowest
> `TODO` in the active phase unless `ACTIVE TASK` says otherwise.

**ACTIVE TASK:** `TASK-001`

> **UI tasks** (wizard, dashboards, settings) follow `docs/11-UI-DEVELOPMENT.md` and
> consume the matching `design/<surface>/<slug>/` drop. They run only after the data
> API they render exists. **Deployment** targets Railway (`docs/12`).
>
> **Every task** applies `docs/13-SECURITY.md` (strong security) and
> `docs/14-ENGINEERING-PRINCIPLES.md` (no over-engineering; **stop and flag** on any
> doubt instead of guessing).

---

## Phase 0 — Foundation
| ID | Task | Acceptance criteria (incl. tests) | Status |
|---|---|---|---|
| TASK-001 | Monorepo (pnpm+Turborepo), `packages/config` (eslint+security, tsconfig, prettier, **vitest preset**), root scripts. | `pnpm install/lint/typecheck/build` pass on empty workspace; `pnpm test` runs (0 tests OK). | REVIEW |
| TASK-002 | `tooling/docker-compose.yml`: Postgres+Timescale, Redis/Valkey, MinIO, Mailpit, Ollama. `.env.example` + typed config. | `docker compose up` healthy; api reads config; smoke test connects to each service. | REVIEW |
| TASK-003 | `packages/db`: Prisma + tenancy models (`Store/User/Membership/Subscription`), first migration, Timescale SQL step, seed. **Migration tests.** | Migration applies clean + on-existing; `db:seed` works; migration test green. | REVIEW |
| TASK-004 | `apps/api` NestJS skeleton: health route, Prisma module, **tenant guard**, error/logging middleware, OTel init. | `/health` 200; **tenant-isolation unit test** proves unscoped query is rejected. | DONE |
| TASK-004b | **Connect Railway staging** for `apps/api` (`docs/12`). **OWNS the api production build** (dist/bundle + start command — TASK-004 ships none: build=`tsc --noEmit`, `/health` proven in-process) incl. building the workspace libs (`@profitily/db`/`@profitily/shared`) to runnable JS. | Built api **boots and serves `/health`** on staging after CI; migrations run pre-deploy. | REVIEW |
| TASK-005 | `apps/web` + `apps/shopify-app` skeletons (App Router, Tailwind; Polaris). Shared layout, auth stub. | Both build & boot; **Playwright smoke** loads each app. | TODO |
| TASK-006 | **CI pipeline** (GitHub Actions): install, lint, typecheck, unit+integration, build; **security scan** (Gitleaks, npm audit, Semgrep) on PRs into `develop`. Branch protection on `main`+`develop`. | CI green on a trivial PR into `develop`; secret scan runs; protection documented. | REVIEW |
| TASK-007 | **Test harness**: Testcontainers helper (PG/Redis/MinIO), Playwright config, fast-check + Stryker + k6 + Pact wiring, coverage thresholds. | `pnpm test:int`, `test:e2e`, `test:load`, `test:mutation` commands run end-to-end. | TODO |
| TASK-008 | **UI foundation**: app shell (P0/S2), design tokens from `design/tokens`, Polaris (shopify-app) + Tailwind/shadcn (portal) setup, component-test + axe + visual-snapshot harness. | Shell renders with nav/store-switcher/date-range; **RTL + axe + Playwright** smoke green; tokens applied. | TODO |
| TASK-009 | **Tenant-guard hardening** (when raw/nested patterns appear): ESLint rule banning `$queryRaw`/`$executeRaw` on tenant data without explicit `storeId` scoping; auto-scope or reject nested writes into tenant models. Extends the isolation suite for both. | Lint flags an unscoped raw tenant query; isolation suite covers a nested-write case. | TODO |

## Phase 1 — Shopify App, Auth & Billing
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-010 | Shopify OAuth install + encrypted token storage. | Install persists encrypted token; **idempotency test** for re-install. | TODO |
| TASK-011 | Session auth (JWT) + Shopify session verification; user/membership provisioning. | Embedded requests authed; **multi-tenant isolation test** (agency user, 2 stores). | TODO |
| TASK-012 | Shopify managed billing (Free/Growth/Pro/Agency) + plan gating. | Plan select creates charge; **integration test**: gated route blocked under-tier. | TODO |
| TASK-013 | Webhooks: registration, HMAC verify, idempotent enqueue; handlers for uninstall/orders/refunds/products. | **Contract test** for payload shape; **replay test** proves no-op on redelivery. | TODO |
| TASK-014 | 7-step setup wizard (state machine, resumable). | **E2E (Playwright)** completes wizard; refresh resumes; redirects to web. | TODO |

## Phase 2 — Data Ingestion
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-020 | `integrations/shopify`: client, rate-limit handling, `normalize()`. | **Unit tests** on sample payloads; backoff covered; **contract test** vs Shopify schema. | TODO |
| TASK-021 | Historical backfill (orders/products/variants/customers): chunked, resumable. | **Integration test**: interrupt+resume yields no dupes. | TODO |
| TASK-022 | Real-time webhook → persist pipeline. | **Integration test**: order/refund webhook lands in PG; idempotent. | TODO |
| TASK-023 | Sync-health + DLQ + retry/backoff. | **Integration test**: failing job → DLQ after retries; health exposed. | TODO |

## Phase 3 — Cost Management & Shipping Engine
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-030 | Cost config CRUD + UI (ProductCost temporal, Packaging, Fulfillment, PaymentRule, Opex, Fees). | **Integration tests** for CRUD + temporal resolution. | TODO |
| TASK-031 | Cost entry: manual / CSV / bulk with validation + error report. | **Integration test**: bad rows reported, good rows applied. | TODO |
| TASK-032 | `packages/core` **shipping rule engine** (all types + hybrid). | **Unit + property tests**: full matrix in `docs/06 §3` green; deterministic. | TODO |
| TASK-033 | Shipping rule CRUD + UI (priority order, live preview). | **E2E**: create/reorder rules; preview resolves a sample order. | TODO |

## Phase 4 — Shipping & Ad Integrations
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-040 | Shipping integrations (Shiprocket, Shipway, Delhivery, Shopify Shipping). | Common interface; **contract tests** per provider; actual overrides rule engine. | TODO |
| TASK-041 | Ad integrations (Meta, Google, TikTok): campaigns + daily spend + attribution. | **Contract tests**; encrypted tokens; configurable backfill. | TODO |

## Phase 5 — Profit & Allocation Engine
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-050 | `Money` + cost-stack + order profit. | **Unit + property tests** (golden + invariants); no floats. | TODO |
| TASK-051 | Roll-ups (variant→product→store→customer) with revenue-share split. | **Property test**: reconciliation to the paise across grains. | TODO |
| TASK-052 | Ad-allocation engine (Direct→RevShare→AI); write `AdAttribution`. | **Unit tests**: per-campaign sum == spend; precedence. | TODO |
| TASK-053 | Opex amortization. | **Unit tests**: both bases; re-amortization on change. | TODO |
| TASK-054 | Snapshot writer + Timescale continuous aggregates; PG mirror. | **Integration test**: snapshots queryable; components preserved. | TODO |

## Phase 6 — Dashboards & Reporting
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-060 | Read API over Timescale (range/grain/filters). | **Load test (k6)**: p95 < 2s on 50k-order seed; numbers match engine. | TODO |
| TASK-061 | Executive dashboard + profit waterfall. | **Component + E2E tests**; values reconcile with seed. | TODO |
| TASK-062 | Product/Variant/Order/Campaign/Customer dashboards. | **E2E**: each grain's metrics; reconcile. | TODO |
| TASK-063 | Drill-down `Store→Product→Variant→Order`. | **E2E**: filters preserved; leaf shows order waterfall. | TODO |
| TASK-064 | Report generation (daily/weekly/monthly) → MinIO; email via Mailpit. | **Integration test**: generated, stored, retrievable; email captured. | TODO |

## Phase 7 — AI Layer
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-070 | `packages/ai`: model router (Ollama-first, escalation+cache), read-only grounding tools. | **Unit tests**: router thresholds; tools return engine numbers; cache hit path. | TODO |
| TASK-071 | AI Agent Hub UI + conversation persistence. | **E2E**: NL question → grounded answer; history saved. | TODO |
| TASK-072 | Agents: Profit/Marketing/Inventory/Forecast/CFO. | **Eval tests**: each answers its `docs/01 §6` examples on seed data; **prompt-injection test**. | TODO |
| TASK-073 | Recommendation engine. | **Unit/integration**: recommendations from snapshots; status transitions. | TODO |
| TASK-074 | Alerts (profit drop, shipping spike, refund spike, reorder, campaign unprofitable). | **Integration test**: fire-once per breach; threshold edges. | TODO |

## Phase 8 — Hardening & Launch
| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| TASK-080 | Tenant-isolation audit + token-encryption review + **DAST (OWASP ZAP)** + secret scan. | **Full isolation suite** green; ZAP baseline clean; no plaintext secrets. | TODO |
| TASK-081 | Load test (50k+ order store) + index/cache tuning. | **k6** SLAs met; slow queries indexed. | TODO |
| TASK-082 | Observability: OTel+Prometheus+Grafana+Loki dashboards; GlitchTip; per-store sync views. | Dashboards live; alert on sync failure; errors captured. | TODO |
| TASK-083 | Billing edge cases (up/downgrade, dunning); uninstall retention. | **Integration tests** for tier changes + uninstall policy. | TODO |
| TASK-084 | **Mutation testing pass (Stryker)** on `packages/core`; raise weak tests. | Mutation score ≥ target (set in `docs/08`); gaps fixed. | TODO |
| TASK-085 | **Railway deployment + Git auto-deploy** (`docs/12`): services (web/shopify-app/api/worker/cron) + Timescale + Redis; `railway.json` per app; connected branches `develop`→staging & `main`→production with **Wait for CI**; watch paths; pre-deploy migrations; CI-gated. | Merge to `develop` auto-deploys staging after CI passes; migrations run pre-deploy; webhooks reach the staging `shopify-app` domain; rollback verified. | TODO |

## Backlog (roadmap)
WooCommerce/BigCommerce/Magento · Amazon/Walmart/Etsy · CFO platform (cash-flow
forecasting, budgeting, profit simulations, scenario modeling) · Agency white-label ·
optional ClickHouse migration if Timescale rollups hit scale limits.

---

### Board update rules
Executor: `TODO→DOING` on start, `→REVIEW` on PR. Reviewer: `→DONE` on merge or back to
`DOING` with comments. Discovered work → propose a new `TASK-XXX`; never expand scope
silently.
