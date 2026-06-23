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
| Phase 0 | Foundation | 5 / 10 |
| Phase 1 | Shopify App, Auth & Billing | 0 / 5 |
| Phase 2 | Data Ingestion | 0 / 4 |
| Phase 3 | Cost Management & Shipping Engine | 0 / 4 |
| Phase 4 | Shipping & Ad Integrations | 0 / 2 |
| Phase 5 | Profit & Allocation Engine | 0 / 5 |
| Phase 6 | Dashboards & Reporting | 0 / 5 |
| Phase 7 | AI Layer | 0 / 5 |
| Phase 8 | Hardening & Launch | 0 / 6 |

> TASK-001–004 + TASK-006 are merged. TASK-004b (Railway wiring manual/pending), TASK-005
> (frontend skeletons), TASK-007 (test harness), TASK-008 (UI foundation), and TASK-009
> (tenant-guard hardening) are in `REVIEW` (PRs open into `develop`).

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

### TASK-004b — apps/api production build + Railway staging deploy (api only)
- **Date:** 2026-06-22 · **Branch:** `task/TASK-004b-api-prod-build` → `develop`
- **What shipped (committable):**
  - **Workspace libs build to runnable JS:** `@profitily/shared` + `@profitily/db` get a
    `tsc` build (`tsconfig.build.json` → `dist`, ESM + `.d.ts`, tests/test-support
    excluded) and `exports`→`dist`; db build runs after `generate`.
  - **apps/api precompiled:** `build` = `swc src --out-dir dist --strip-leading-paths`
    (ESM + decorator metadata via `.swcrc`); `start` = `node dist/main.js`; `@swc/cli`
    added; root `start:api`.
  - **`apps/api/railway.json`** (Nixpacks): `buildCommand` = `pnpm install --frozen-lockfile
    && pnpm build`; `startCommand` = `node apps/api/dist/main.js`; `preDeployCommand` =
    `pnpm --filter @profitily/db migrate:deploy`; `healthcheckPath` `/health`; restart
    ON_FAILURE; watch `apps/api/**` + `packages/**`.
  - **`prisma` moved to a runtime dependency** of `@profitily/db` (was a devDep) so the
    pre-deploy migrate survives any prod devDep prune; `@swc/cli`/`typescript` stay
    build-time only. Build/prune ordering documented in `docs/12 §11`.
  - **ADR 0002** (Railway accepted paid host, usage-based cost, staging api+Timescale
    scope, reversibility); `docs/12 §11` (concrete `railway.json` + env table marked
    REAL-SECRET / REFERENCE / PLACEHOLDER).
- **DB-independent `/health` (liveness):** PrismaService already lazy-connects (no eager
  `$connect`), so no code change needed. **Proven:** built artifact booted with
  `DATABASE_URL` pointed at a dead port (no DB) → `GET /health` → **200 `{"status":"ok"}`**
  (boot log: "Nest application successfully started"; no DB connection).
- **Security:** no secrets generated/printed/committed — `JWT_SECRET`/`ENCRYPTION_KEY` are
  user-set in Railway only; `.env.example` keys stay placeholders; DB private on Railway,
  only api public; no Redis/MinIO added.
- **Gates:** lint 4/4, typecheck 7/7, test 7/7 (shared 14 + api 4; db suites run in CI
  against the Timescale service), build 4/4 (api SWC 12 files; libs `dist`).
- **Builder switched to a per-app Dockerfile (fix):** the first Railway deploy failed at
  install — Nixpacks' **corepack@0.24.1** can't run **pnpm@11.1.2** on **Node 24**
  (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`), and it injected service secrets as build
  `ARG`/`ENV`. Replaced with **`apps/api/Dockerfile`** (Debian/glibc; `npm i -g
  pnpm@11.1.2` not corepack; installs OpenSSL for the Prisma engine; **no build-time
  secrets**; keeps pnpm+node_modules+prisma for the pre-deploy migrate). `railway.json`
  → `builder: DOCKERFILE` (`dockerfilePath: apps/api/Dockerfile`; `RAILWAY_DOCKERFILE_PATH`
  fallback documented) + `.dockerignore` (no `node_modules`/`dist`/`.env`). **Proven
  locally:** `docker build -f apps/api/Dockerfile -t profitily-api .` → run with DB **down**
  → `GET /health` → **200 `{"status":"ok"}`**; image has pnpm 11.1.2 + prisma 6.19.3
  (`debian-openssl-3.0.x` engine); `.env` absent from the image.
- **MANUAL / pending (mine):** Railway dashboard wiring + final staging `/health` 200 —
  enumerated as the B) checklist in the Build Summary (user generates secrets; 1 GB
  Timescale volume; env list with real-vs-placeholder marked; **Dockerfile builder**).
- **Follow-ups:** make not-yet-used subsystem env (S3/SMTP/Ollama) optional-until-used so
  staging needs only real core secrets; add a `development` export condition only if
  build-first proves a recurring footgun; **multi-stage Dockerfile slimming** (drop dev
  deps/source from the final image once a separate migrate step or pruned runtime exists).

### TASK-005 — apps/web + apps/shopify-app skeletons
- **Date:** 2026-06-22 · **Branch:** `task/TASK-005-frontend-skeletons` → `develop`
- **What shipped:**
  - **`apps/web`** — Next 15 App Router + TS + **Tailwind v4** (`@tailwindcss/postcss`);
    minimal root layout (header showing the stub user) + home route. No Polaris.
  - **`apps/shopify-app`** — Next 15 App Router + TS + **Polaris 13**; root layout imports
    Polaris CSS and a `'use client'` `Providers` wraps children in `AppProvider` + en
    i18n; S2 app-home as a static Polaris `Page`/`Card` (plan badge + sync placeholder +
    "Open Profitily Portal" CTA). No App Bridge. No Tailwind/shadcn.
  - Per-app **auth stub** `src/lib/session.ts` (`getStubSession()`), greppable marker
    `// STUB(TASK-010/011): replace with real Shopify OAuth/JWT session`.
  - Turbo wiring (dev/build/start/lint/typecheck per app; `build.outputs` += `.next/**`,
    `−.next/cache`); minimal root **Playwright** config (2 webServers) + one smoke per app;
    root `pnpm test:e2e`. Committed 2-line `next-env.d.ts` (tsc-safe; `next build`
    re-adds the typed-routes ref ephemerally).
  - **ADR 0003** (React 18.3 + Next 15 + Polaris ^13.9 baseline; Polaris-React frozen at
    React 18); ADR index corrected (added the missing **0002 Railway** entry; renumbered
    placeholders to 0004/0005). README ports note (web 3000 / api 3001 / shopify-app 3002).
- **React baseline (ADR 0003):** Polaris 13 peers React ^18 (no React 19) → pinned
  **React 18.3 + Next 15 + Polaris ^13.9 for both apps** (consistency + compatibility),
  not the latest React 19. `sharp` added to the build-script allowlist (Next image opt).
- **Security:** no secrets, no `.env` keys added (confirmed `.env.example` unchanged), no
  DB/API/PII access; auth is an isolated, marked stub.
- **Test cases covered:** **Playwright smoke ×2** — web `:3000` (home heading + stub user)
  and shopify-app `:3002` (Polaris app-home heading + CTA): **2 passed**. RTL/axe/visual
  **deferred to TASK-008** (skeleton has no component logic); full e2e harness + CI browser
  install **deferred to TASK-007** (smoke stays out of the CI `verify` gate). Gates:
  lint 6/6, typecheck 9/9, build 6/6 (both Next apps prerender static). `pnpm dev` boots
  **all three** (web 3000 / api 3001 / shopify-app 3002) — verified, no collision.
- **Deviations:** (1) tiny `apps/api` `dev` script tweak (`--env-file-if-exists=../../.env`)
  so `pnpm dev` boots api under turbo's strict env filtering — required for the all-three
  acceptance. (2) corrected the stale ADR index. No `design/` drop was used (skeletons —
  built to the §4 S2 / §5 P0 specs).
- **Follow-ups:** real shell/tokens/components (TASK-008); full e2e/RTL/axe/visual harness
  + CI e2e (TASK-007); real Shopify auth/App Bridge (TASK-010/011).

### TASK-007 — test harness (Testcontainers, Playwright/CI, fast-check, Stryker, k6, Pact, coverage)
- **Date:** 2026-06-22 · **Branch:** `task/TASK-007-test-harness` → `develop`
- **What shipped (wiring + one trivial proof per tool — no feature tests):**
  - **`@profitily/test-support`**: Testcontainers helper (`startPostgres`+Timescale /
    `startValkey` / `startMinio`, pinned to TASK-002 images) + `docker-gate` (skip local
    / **fail-loud under CI/`REQUIRE_DOCKER`**, mirrors `db-gate`) + 3 integration proofs
    (PG `SELECT 1`+timescaledb, Valkey PING, MinIO bucket head). `pnpm test:int`.
  - **`packages/core` scaffold** (`__harnessProbe`): unit + **fast-check** property test;
    **Stryker** (`pnpm test:mutation`, non-breaking threshold); **100% coverage enforced
    on branch+line+function+statement** (CI fails on breach). ⚠️ **TASK-050 OWNS deleting
    `__harnessProbe`** and replacing it with the real profit engine (`docs/06`).
  - **Pact** consumer proof (in-process mock, no Docker) → `pnpm test:contract`.
  - **k6** trivial scenario (`tooling/k6/smoke.js`) → `pnpm test:load` (via `grafana/k6`
    Docker locally; runner Docker in nightly).
  - **Playwright** extended (kept the 2 TASK-005 smokes green); nightly installs browsers.
  - Commands wired: `test:int`, `test:contract`, `test:mutation`, `test:load`, `test:all`
    (+ existing `test`, `test:e2e`) via turbo tasks + root scripts.
  - **CI**: PR `verify` gains `test:contract` (fast, no Docker); new **`nightly.yml`**
    (schedule + dispatch) runs the heavy suites — integration (`REQUIRE_DOCKER=1`), e2e
    (+browser install), mutation, load. `security` job unchanged.
- **`test:int` placement decision (bind-down 3 — my call): NIGHTLY + on-demand, not the
  PR gate.** Three no-op container probes would tax every PR ~30–60s for empty signal;
  promote `test:int` to the PR gate at the first task that writes a *real* integration
  test (TASK-013/021/022). `test:contract` is in the PR gate (fast, no Docker, real
  signal). The Docker-gate force-runs in CI and never silently skips.
- **Coverage strategy:** 100%/4-metrics scoped to `packages/core` only; no global/other
  floors yet; API ratchets to ≥80% when real services land (TASK-010+).
- **Security/notes:** synthetic data only; no secrets/`.env` keys (`.env.example`
  unchanged); pinned images. `ssh2`/`cpu-features` (testcontainers' SSH path) left
  unbuilt (`allowBuilds: false`) — we use socket Docker; pure-JS fallback suffices.
- **Proofs (all green locally):** `test` (core 100%), `test:contract` (1), `test:int`
  (3, Docker; **3 skipped** Docker-down, **fail-loud** under `REQUIRE_DOCKER`),
  `test:mutation` (Stryker completes), `test:load` (k6 check), `test:e2e` (2 smokes).
  Gates: lint 8/8, typecheck 11/11, build 7/7.
- **Deferred (stated, not built):** a11y/visual/RTL (TASK-008), real load/contract/
  mutation gates (feature tasks), DAST (TASK-080), `test:a11y`/local `test:sec`.

### TASK-009 — tenant-guard hardening (raw-query + nested-write boundaries)
- **Date:** 2026-06-23 · **Branch:** `task/TASK-009-tenant-guard-hardening` → `develop`
- **What shipped (sev-1; closed the two TASK-004 bypass boundaries, fail-closed):**
  - **Raw SQL — three layers:** (1) ESLint `no-restricted-syntax` ban (shared preset,
    error, repo-wide) on `$queryRaw`/`$queryRawUnsafe`/`$executeRaw`/`$executeRawUnsafe`;
    (2) **runtime throw** — the guarded client's extension refuses all four raw ops
    (`TenantIsolationError`); (3) audited **escape hatch** = unguarded client + manual
    `storeId` predicate + greppable `// TENANT-RAW-OK:` disable. **Bind-down 1 → world (a)
    shipped:** Prisma 6.19.3's query extension exposes raw-op hooks
    (`TypeMap['other']['operations']`), so the runtime layer is real, not lint-only.
  - **Nested writes — detect & REJECT (not auto-scope):** DMMF-derived
    `relationField → targetModel` map; a bounded recursive scan of write payloads throws
    on any nested write verb targeting a **tenant** model. Non-tenant nesting (e.g.
    connecting a global `User`) is allowed. Limit stated: cross-tenant `connect`
    verification needs a DB read → rejected, not scoped.
  - **Isolation suite** extended (real-PG, db-gated, force-run in CI): group (e) raw
    (guarded refuses; escape-hatch unguarded scoped read) + group (f) nested (reject via
    `User→Membership` and `Store.subscription` with **proof nothing written**; allowed
    non-tenant nesting; safe top-level pattern). **16 → 22 cases.**
  - ESLint RuleTester unit test (`packages/config`) proves the raw verbs are flagged and
    scoped model ops are not.
- **Bind-down 2 (grep for existing raw):** **none** — only the doc-comment mentions in
  `extension.ts`; tests/seed/smoke use `pg` directly. Ban landed clean.
- **Bind-down 3 (bootstrap path linkage → TASK-010/011):** new-tenant **provisioning**
  (store + its first tenant rows) must run on the **unguarded** client — nested tenant
  writes are now rejected on the guarded client. No `createUnscopedClient()` added
  (speculative, no caller); **TASK-010/011 owns adding the named bootstrap path** with its
  first real caller.
- **Security/notes:** sev-1 fail-closed; synthetic data only; no secrets/`.env` keys
  (`.env.example` unchanged); guard core (ALS + extension) unchanged.
- **Proofs:** lint 8/8 (0 errors), typecheck 11/11, build 7/7; `pnpm test` config 7
  (incl. raw-ban RuleTester) + db 24 (isolation **22** incl. e/f + migrate 2) + api 4 —
  real-PG via `pnpm infra:up` on alt ports (5433; markopz held 5432), force-run with
  `REQUIRE_DB=1`.
- **Flag raised (separate PR):** `.gitignore` `reports/` silently ignores the
  `apps/web/src/app/reports/` route — **PR #11 (TASK-008) is missing that route**. Out of
  TASK-009 scope; flagged for the planner to fix in PR #11 (narrow the pattern to a
  root-anchored `/reports/` + re-add the route).

---

## Module completion matrix

| Module | Status | Tasks | Key tables | Security verified | Tests |
|---|---|---|---|---|---|
| M00 Platform / Shared | in progress | TASK-001 (done), 002 (done), 004 (done; api skeleton/config/logging/error/OTel), 006 (done; CI gate + security scans), 004b (REVIEW; api prod build + Railway staging — deploy manual/pending), 007–009 | — | eslint-plugin-security active; engine-strict; frozen lockfile; local-only dev creds; secret-safe env validation; pinned images; Pino redaction (no PII/bodies); generic error bodies; helmet; **CI: Gitleaks + pnpm audit (high) + OSV + Semgrep; multer DoS patched via override**; Railway secrets user-set (none in repo) | sanity + env-loader (15 Vitest) green; smoke green; /health 200 + error-filter (apps/api); **built api boots DB-free, /health 200**; **DB suites force-run in CI**; static gates green |
| UI surfaces (apps/web, apps/shopify-app) | skeleton | TASK-005 (REVIEW; Next 15 skeletons), 008 (shell/tokens/components), 007 (e2e harness) | — | auth = isolated marked stub (TASK-010/011); no secrets/`.env` keys; no DB/API access; Polaris/Tailwind split structural | Playwright smoke ×2 green (web :3000, shopify-app :3002); RTL/axe/visual → TASK-008 |
| Test harness (`@profitily/test-support`, `packages/core` scaffold) | wired | TASK-007 (REVIEW); fills with real engine/integration tests at TASK-050/013/021/022 | — | docker-gate force-runs in CI (no silent skip); synthetic data only; pinned images; ssh2/cpu-features native builds disabled (socket Docker) | `test:int` (3 proofs, Docker-gated), `test:contract` (Pact), `test:mutation` (Stryker), `test:load` (k6), fast-check property + **core 100%/4-metric coverage**; nightly workflow runs heavy suites |
| M01 Identity & Tenancy | in progress | TASK-003 (done), 004 (done; tenant guard), 009 (REVIEW; raw + nested boundaries closed) | Store, User, Membership, Subscription | **fail-closed tenant isolation** (Prisma extension + ALS context); read + write-path scoping; **raw SQL refused on guarded client + ESLint-banned repo-wide**; **nested tenant writes rejected**; placeholder token (no real secret); no PII; store-scoped cascades | migration tests (clean + on-existing) + **tenant-isolation suite (22 cases incl. write-path, raw, nested)** + ESLint raw-ban RuleTester green; **force-run in CI** (no silent skip); SKIPPED locally w/o DB |
