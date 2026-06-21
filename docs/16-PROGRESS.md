# 16 — Progress & Completed Modules (Build Log)

> **Living log.** Updated at **step 7** of the build loop (`docs/09-WORKFLOW.md`) — i.e.
> when a task's PR is **merged**, not when it opens. It records what shipped, the
> security controls applied, and the tests that covered it. Cross-references:
> the execution board (`docs/07-PROJECT-PLAN.md`), the testing strategy
> (`docs/08-TESTING.md`), and the security baseline (`docs/13-SECURITY.md`).
>
> A task in `REVIEW` on the board appears here only after it merges to `develop`.

---

## Phase status

| Phase | Theme | Tasks done / total |
|---|---|---|
| Phase 0 | Foundation | 1 / 8 |
| Phase 1 | Shopify App, Auth & Billing | 0 / 5 |
| Phase 2 | Data Ingestion | 0 / 4 |
| Phase 3 | Cost Management & Shipping Engine | 0 / 4 |
| Phase 4 | Shipping & Ad Integrations | 0 / 2 |
| Phase 5 | Profit & Allocation Engine | 0 / 5 |
| Phase 6 | Dashboards & Reporting | 0 / 5 |
| Phase 7 | AI Layer | 0 / 5 |
| Phase 8 | Hardening & Launch | 0 / 6 |

> TASK-001 is merged. TASK-002 is in `REVIEW` (PR open into `develop`); it flips to
> **done** here once merged.

---

## Completed log

### TASK-001 — Monorepo scaffolding (pnpm + Turborepo + shared config)
- **Date:** 2026-06-21
- **Branch:** `task/TASK-001-monorepo-scaffold` → `develop`
- **What shipped:**
  - Root pnpm + Turborepo workspace: `pnpm-workspace.yaml` (`apps/*`, `packages/*`),
    `turbo.json` (build/lint/typecheck/test/dev tasks), root scripts
    (`lint`/`typecheck`/`test`/`build`/`dev`/`format`).
  - `packages/config`: shared presets — TypeScript base (`tsconfig.base.json`,
    strict), ESLint 9 flat config with **`eslint-plugin-security`**, Prettier preset,
    Vitest preset — plus `src/index.ts` and one Vitest sanity test.
  - Root configs consuming the presets (`eslint.config.mjs`, `prettier.config.mjs`,
    `tsconfig.json`, `vitest.config.ts`).
  - Toolchain pins & hygiene: Node engines `>=22`, `.nvmrc` = `24`, pnpm pinned via
    `packageManager` (11.x), `.npmrc` (`engine-strict`), `.editorconfig`,
    `.prettierignore`, committed `pnpm-lock.yaml`.
- **Security controls applied:** `eslint-plugin-security` active in the shared ESLint
  preset (verified: a probe call to `child_process.exec` tripped
  `security/detect-child-process`, then removed); `engine-strict` enforces the Node
  floor; reproducible installs from the committed lockfile. No secrets introduced.
- **Test cases covered:** static gates green — `pnpm lint`, `pnpm typecheck`,
  `pnpm build` (no build tasks yet on the empty workspace), `pnpm test`. The Vitest
  preset is proven by the `@profitily/config` sanity test (1 passed); `passWithNoTests`
  keeps future empty packages green.
- **Follow-ups:** CI pipeline to run these gates on PRs — **TASK-006**; coverage
  thresholds / first engine coverage — **TASK-050** (and harness in **TASK-007**).

### TASK-002 — Local infra (Docker Compose) + typed env-config + smoke check
- **Date:** 2026-06-21
- **Branch:** `task/TASK-002-local-infra-config` → `develop`
- **What shipped:**
  - `tooling/docker-compose.yml`: healthchecked **Postgres+TimescaleDB**, **Valkey**,
    **MinIO** (+ one-shot `mc` bucket-init for `profitily-reports`), **Mailpit**, and
    **Ollama** (gated behind the opt-in `ai` profile). Named volumes; every image
    pinned to a specific version tag (no `:latest`). Host ports are overridable via
    `*_HOST_PORT` env vars (canonical defaults 5432/6379/9000/9001/1025/8025/11434).
  - `packages/shared`: zod-validated `loadEnv()`/`Env` typed env loader mirroring
    `.env.example` — strict on core/crypto vars, optional passthrough for
    integration/Shopify/AI keys — with a secret-safe, aggregated failure message.
  - `tooling/smoke.ts` + `pnpm smoke`: connects to PG (`SELECT 1` + TimescaleDB
    extension availability), Redis/Valkey (PING), MinIO (`/health/live`), and Mailpit
    (SMTP `220`); redacted output; non-zero exit on any failure.
  - Root scripts `infra:up` / `infra:up:ai` / `infra:down` / `smoke`; `tooling/README.md`.
- **Security controls applied (`docs/13 §5,§11`):** secrets only via `.env`
  (git-ignored); compose creds are explicit **local-only dev defaults**; env loader
  **fails closed** with a **secret-safe** error (variable names only — values, incl.
  `DATABASE_URL` password and `ENCRYPTION_KEY`, are never echoed); `ENCRYPTION_KEY`
  length (≥32) and `JWT_SECRET` validated; smoke output redacted; **all images pinned**
  (supply chain).
- **Test cases covered:** env-loader **unit tests (14, Vitest)** — valid parse, typed
  output, number/boolean coercion, defaults, optional keys, missing/invalid required
  vars (postgres/redis URL, SMTP_PORT, ENCRYPTION_KEY), aggregated multi-error, and
  **"no secret value in error"**. Live: `pnpm infra:up` → four core services **healthy**;
  `pnpm infra:up:ai` → Ollama additionally healthy; `pnpm smoke` green with
  **TimescaleDB v2.17.2 available**. All static gates (lint/typecheck/test/build) green.
- **Notes / follow-ups:** verification ran on **alt host ports** (`DB_HOST_PORT=5433`,
  `REDIS_HOST_PORT=6380`) because another local stack held 5432/6379 — the committed
  defaults remain canonical; the override mechanism is the permanent solution. Prisma
  schema/migrations/hypertables → **TASK-003**; CI wiring of these gates → **TASK-006**;
  Testcontainers integration harness → **TASK-007**.

---

## Module completion matrix

| Module | Status | Tasks | Key tables | Security verified | Tests |
|---|---|---|---|---|---|
| M00 Platform / Shared | in progress | TASK-001 (done), 002 (REVIEW), 003–008 | — | eslint-plugin-security active; engine-strict; frozen lockfile; local-only dev creds; secret-safe env validation; pinned images | sanity + env-loader (15 Vitest) green; smoke green; static gates green |
