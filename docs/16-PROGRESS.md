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
| Phase 0 | Foundation | 4 / 10 |
| Phase 1 | Shopify App, Auth & Billing | 0 / 5 |
| Phase 2 | Data Ingestion | 0 / 4 |
| Phase 3 | Cost Management & Shipping Engine | 0 / 4 |
| Phase 4 | Shipping & Ad Integrations | 0 / 2 |
| Phase 5 | Profit & Allocation Engine | 0 / 5 |
| Phase 6 | Dashboards & Reporting | 0 / 5 |
| Phase 7 | AI Layer | 0 / 5 |
| Phase 8 | Hardening & Launch | 0 / 6 |

> TASK-001–004 are merged. TASK-006 is in `REVIEW` (PR open into `develop`); it flips to
> **done** here once merged. (Phase 0 also tracks TASK-004b — api production build — and
> TASK-009 — tenant-guard raw/nested-write hardening.)

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
    extension availability), Redis/Valkey (PING), MinIO (`/health/live` **plus an
    authenticated HeadBucket asserting the `profitily-reports` bucket exists**), and
    Mailpit (SMTP `220`); redacted output; non-zero exit on any failure.
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

### TASK-003 — `packages/db` (Prisma): tenancy models, first migration (+ TimescaleDB extension), seed, migration tests
- **Date:** 2026-06-22
- **Branch:** `task/TASK-003-db-tenancy` → `develop`
- **What shipped:**
  - `packages/db` with Prisma 6.19.3 (co-located `prisma` + `@prisma/client`): schema
    with the four tenancy models (`Store`, `User`, `Membership`, `Subscription`) and
    enums `PlanTier`/`SubStatus`/`Role` per `docs/04 §1` — uniques (`shopDomain`,
    `email`, `(userId,storeId)`, `Subscription.storeId`), `@@index([plan])`,
    `@@index([storeId])`, and store-scoped cascade FKs.
  - First migration `20260622021548_init` prepended with
    `CREATE EXTENSION IF NOT EXISTS timescaledb` (no hypertables yet — TASK-054).
  - Idempotent demo seed (store + owner + membership + subscription) with a labelled
    **placeholder** `accessToken` (no real secret; encryption util is TASK-010).
  - Reachability-gated migration tests (apply-from-clean + apply-on-existing) using
    throwaway `profitily_migtest_<rand>` DBs dropped in `afterAll` even on failure.
  - `src/index.ts` re-exports the generated client; root scripts
    `db:generate`/`db:migrate`(=`migrate deploy`)/`db:seed`; turbo `generate` task that
    `typecheck`/`test`/`build` depend on; the generated client is **git-ignored**
    (default output under `node_modules`).
- **Security controls applied (`docs/13 §5–6`):** no real secrets/PII — seed
  `accessToken` is a clearly-labelled dev placeholder; no crypto util built (TASK-010);
  only a `.test` demo email; `DATABASE_URL` stays in git-ignored `.env`; Prisma build
  scripts added to the `allowBuilds` allowlist **explicitly and minimally**
  (`@prisma/client`, `@prisma/engines`, `prisma`); frozen lockfile retained.
- **Test cases covered:** migration **apply-from-clean** (migration recorded; 4 tables
  present; **timescaledb extension enabled** via `pg_extension`; Prisma data round-trip;
  store-cascade removes membership + subscription) and **apply-on-existing**
  (re-running `migrate deploy` is a no-op; `_prisma_migrations` count unchanged; data
  preserved). Verified live with `pnpm infra:up`: both pass; with DB down they report
  **SKIPPED** (visible, with reason). `db:migrate` clean+idempotent and `db:seed`
  idempotent confirmed manually. All static gates green (lint/typecheck/test/build).
- **Follow-ups:** **TASK-006 (CI) must force-run the migration tests against a real
  Postgres service and fail if it is unreachable** (locally they self-skip, which must
  not mask a CI regression). Hypertables/continuous aggregates → TASK-054; tenant-scoping
  Prisma guard → TASK-004; token encryption util → TASK-010.

### TASK-004 — apps/api NestJS skeleton + tenant-isolation guard (sev-1)
- **Date:** 2026-06-22 · **Merged:** 2026-06-22 (PR #5)
- **Branch:** `task/TASK-004-api-skeleton-tenant-guard` → `develop`
- **What shipped:**
  - **Tenant-isolation guard** in `@profitily/db`: a request-scoped `storeId`
    (`AsyncLocalStorage`; `runWithStore`/`getStoreId`) + a DMMF-driven Prisma client
    extension. Models with a `storeId` field are auto-scoped; with no context they
    **throw** (`TenantIsolationError`, fail closed). `Store`/`User` pass through.
    `createTenantClient()` returns a guarded client.
  - **apps/api** NestJS 11 skeleton (ESM, SWC transpile): `ConfigModule` over
    `@profitily/shared` `loadEnv`; `PrismaModule`/`PrismaService` (guarded client, lazy
    connect so boot is DB-free); `GET /health` → 200; `nestjs-pino` logging with
    redaction (auth/cookies) and no bodies; global `AllExceptionsFilter` (generic out /
    detail in logs); minimal OTel init (no-op without an OTLP endpoint); `helmet`;
    `tenantContextMiddleware` **stub** that sets NO storeId yet (queries fail closed
    until auth).
- **Guard design & documented bypass boundaries (sev-1):** scoping covers top-level
  ops — reads merge a `storeId` filter into `where` (so even `findUnique({where:{id}})`
  is scoped, since Prisma's WhereUniqueInput tolerates an extra filter), and
  create/createMany/upsert.create force `data.storeId`. **NOT auto-scoped:**
  `$queryRaw`/`$executeRaw` (raw SQL bypasses the guard); nested writes into tenant
  models; `upsert` `where` scoping relies on the unique selector tolerating an extra
  `storeId`. Documented in `extension.ts`, `docs/13 §2`, and here. Hardening = **TASK-009**.
- **Security controls applied (`docs/13 §2,§4,§9,§12`):** fail-closed tenant isolation;
  `/health` the only public route; default-deny posture (middleware sets no storeId);
  Pino redaction + no PII/secrets/bodies; generic error bodies outward; `helmet`. Rate
  limiting + CORS allowlist deferred (need auth/real domains).
- **Test cases covered:** standing **tenant-isolation suite (16 cases, sev-1)** —
  (a) read scoping incl. cross-tenant `findUnique(B.id)→null`; (b) fail-closed
  (findMany/findUnique/create throw with no context); (c) **write-path** scoping
  (updateMany/deleteMany/create/createMany/upsert under A never touch or create into B,
  proven with a user shared across A & B); (d) Store/User not force-scoped. Plus apps/api
  `/health` 200 (in-process supertest) + error-filter unit tests (3). Reachability-gated:
  run for real with `pnpm infra:up` (all green); **SKIPPED** (visible) when DB down. All
  gates green (lint 4/4, typecheck 5/5, test 37, build).
- **Follow-ups:** **TASK-004b** owns the api production build (dist/bundle + start) and
  must verify the **built** api boots and serves `/health`. **TASK-009** hardens the guard
  for raw queries / nested writes. CI must force-run the DB-gated suites (**TASK-006**).

### TASK-006 — GitHub Actions CI (PR gate) + force-run DB suites + security scans
- **Date:** 2026-06-22
- **Branch:** `task/TASK-006-ci-pipeline` → `develop`
- **What shipped:**
  - `.github/workflows/ci.yml` with two jobs, triggered on **PRs into AND pushes to both
    `develop` and `main`** (so the release PR is gated and Railway's `main`→production
    "Wait for CI" has checks):
    - **`verify`** — `timescale/timescaledb:2.17.2-pg16` service + `REQUIRE_DB=1`;
      `pnpm install --frozen-lockfile` → `db:generate` → `lint` → `typecheck` → `test`
      → `build`. The migration + tenant-isolation suites **execute against the service**.
    - **`security`** — **Gitleaks** (pinned v8.30.1 binary, `gitleaks git`), **`pnpm audit
      --audit-level=high`**, **OSV-Scanner** (pinned action v2.3.8), **Semgrep** (pinned
      1.167.0, token-free `p/typescript,p/security-audit,p/secrets`, `--severity ERROR
      --error`).
  - Shared **`db-gate`** (`packages/db/src/test-support/db-gate.ts`): locally with no DB →
    clean **SKIP**; in CI (`CI=true`) or `REQUIRE_DB=1` with DB unreachable → the suite
    **FAILS loudly** via `requireDbOrThrow` in `beforeAll` (no collection-time crash, no
    silent skip). `migrate.test.ts` + `tenant-isolation.test.ts` refactored onto it.
  - `.gitleaks.toml` — minimal **pattern/value** allowlist (stopwords: `change-me`,
    `minioadmin`, `profitily:profitily`, `placeholder`, `test-encryption-key`,
    `test-jwt-secret`), each commented; **no whole-file/path allows**, so a real secret
    still trips (incl. in `.env.example`).
- **Force-run mechanism (no silent skip):** verified locally — `REQUIRE_DB=1` + DB up →
  **16 isolation + 2 migration RUN and pass**; `REQUIRE_DB=1` + DB down → suite **FAILS**
  with the `[db-gate]` error (exit 1). CI sets `REQUIRE_DB=1` and runs the Timescale
  service, so the suites always run there.
- **Security controls applied (`docs/13 §14`):** secret/dep/SAST scanning on every PR;
  no secrets in the workflow; least-privilege `permissions: contents: read`; pinned
  tool versions; allowlist reviewed to not mask real leaks. **First-run advisory
  handled by FIXING, not weakening:** `pnpm audit` flagged **multer <2.2.0 (HIGH,
  GHSA-72gw-mp4g-v24j)** via `@nestjs/platform-express@11` — resolved with a pnpm
  `overrides: { multer: 2.2.0 }` (same-major security patch; Nest still boots). Gitleaks
  probe verified (planted secret → `leaks found: 1`; then removed).
- **Branch protection** documented in `docs/12 §7` (required checks `verify` + `security`;
  require PR; for `develop` **and** `main`) with an optional `gh api` snippet.
- **Follow-ups:** branch protection is a repo setting a maintainer applies; nightly/load/
  mutation/DAST/CodeQL + Testcontainers harness → TASK-007/080+; revisit the multer
  override when NestJS bumps its own pin.

---

## Module completion matrix

| Module | Status | Tasks | Key tables | Security verified | Tests |
|---|---|---|---|---|---|
| M00 Platform / Shared | in progress | TASK-001 (done), 002 (done), 004 (done; api skeleton/config/logging/error/OTel), 006 (REVIEW; CI gate + security scans), 004b, 005, 007–009 | — | eslint-plugin-security active; engine-strict; frozen lockfile; local-only dev creds; secret-safe env validation; pinned images; Pino redaction (no PII/bodies); generic error bodies; helmet; **CI: Gitleaks + pnpm audit (high) + OSV + Semgrep; multer DoS patched via override** | sanity + env-loader (15 Vitest) green; smoke green; /health 200 + error-filter (apps/api); **DB suites force-run in CI**; static gates green |
| M01 Identity & Tenancy | in progress | TASK-003 (done), 004 (done; tenant guard) | Store, User, Membership, Subscription | **fail-closed tenant isolation** (Prisma extension + ALS context); read + write-path scoping; placeholder token (no real secret); no PII; store-scoped cascades; documented guard bypass boundaries (raw SQL / nested writes → TASK-009) | migration tests (clean + on-existing) + **tenant-isolation suite (16 cases incl. write-path)** green; **force-run in CI** (no silent skip); SKIPPED locally w/o DB |
