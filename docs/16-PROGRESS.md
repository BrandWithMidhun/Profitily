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

> TASK-001–009 are all merged. **Phase 0 (TASK-001–008) is complete**; TASK-009
> (tenant-guard hardening) was promoted into Phase 1 as a security pre-req and is also
> done. (TASK-004b's committable build merged; its Railway dashboard wiring remains a
> manual ops step.)

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

### TASK-008 — UI foundation (app shell, design tokens, RTL + axe + visual harness)
- **Date:** 2026-06-23 · **Branch:** `task/TASK-008-ui-foundation` → `develop`
- **What shipped (shell + tokens + harness + state primitives — no page content):**
  - **Portal app shell** (`apps/web`, P0) in the root layout: left **Sidebar** (13
    sections from a single `lib/nav.ts`), **TopBar** (StoreSwitcher [stub stores] ·
    DateRange [preset dropdown] · AccountMenu [stub session]), **Breadcrumbs**, global
    **Toaster**, responsive mobile **Sheet** drawer. Thin placeholder pages for all 13
    nav routes + home (PageHeader + ComingSoon, bind-down 3).
  - **Shopify app-home** (`apps/shopify-app`, S2): real Polaris page — static sync-status
    card (per-source lag), plan badge, setup-progress, "Open Profitily Portal" CTA.
    Polaris only.
  - **Design tokens:** `design/tokens/tokens.json` is canonical, applied via **Tailwind v4
    `@theme`** (CSS-first); **Inter** via `next/font`; `tabular-money` figures. **A11y
    override (flagged):** the muted-foreground role uses slate-600 (`#475569`) because
    tokens `textMuted` (`#64748b`) only reaches ~4.34:1 on the slate surfaces — below AA
    4.5:1; raw token kept for icons/borders.
  - **shadcn primitives AS-USED only** (button, dropdown-menu, select, sheet, skeleton,
    sonner, avatar, separator) hand-added; **state primitives** (EmptyState, ErrorState)
    + **money primitives** ProfitValue/Delta.
  - **ProfitValue/Delta a11y contract (bind-down 1):** profit/loss = **sign + label +
    colour, never colour alone**; money formatted from **BigInt minor units + currency**,
    tabular (bind-down 4). RTL test asserts sign+label explicitly.
  - **Harness:** RTL (`vitest`+`jsdom`+`@vitejs/plugin-react` v4) in both apps joined to
    `pnpm test` (**PR gate**) + **vitest-axe** structural a11y; **@axe-core/playwright**
    full-DOM a11y + Playwright **visual snapshots** wired **NIGHTLY** (`test:e2e` =
    smoke+a11y; `test:visual` = visual). Visual baselines are **Linux PNGs** generated in
    the Playwright Docker image (`e2e/visual/README.md` documents the regen).
- **Security/notes:** no secrets, no `.env` keys (`.env.example` unchanged), no DB/API/PII;
  auth = the marked stub; a11y is a gate (shell + app-home axe-clean incl. contrast).
- **Proofs:** lint 8/8, typecheck 11/11, build 7/7 (13 routes + home prerender static);
  `pnpm test` web RTL 11 + shopify 1 (shell vitest-axe clean); smoke+a11y **5 green**
  (shell + app-home axe-clean incl. contrast); visual baselines committed (Docker-Linux).
- **Deviations:** `@vitejs/plugin-react` pinned to v4 (Vite 6 / Vitest 3 compat; v6 needs
  Vite 7); muted-foreground AA override (above); `ssh2`/`cpu-features` already disabled
  (TASK-007). No `design/` mockup drop (only tokens.json) — built to §5 P0 / §4 S2 spec.
- **Phase-0 milestone:** Phase 0 (TASK-001–008) complete; TASK-009 follows as a Phase 1
  security pre-req.

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
- **Flag raised (separate PR):** `.gitignore` `reports/` silently ignored the
  `apps/web/src/app/reports/` route — PR #11 (TASK-008) shipped without that route — now
  **resolved in `fix/gitignore-reports-route`** (root-anchored the pattern + re-added the
  route).

### TASK-010 — Shopify OAuth install + encrypted token storage
- **Date:** 2026-06-23 · **Branch:** `task/TASK-010-shopify-oauth` → `develop`
- **What shipped (M02 OAuth install + M01 provisioning + M00 crypto):**
  - **Crypto util** (`@profitily/shared`): `encryptSecret`/`decryptSecret`, **AES-256-GCM**,
    fresh 12-byte IV, 16-byte auth tag verified on decrypt; blob
    `v<n>:iv:tag:ciphertext`; 32-byte key **HKDF-SHA256-derived** from `ENCRYPTION_KEY`
    (config contract unchanged); `v<n>` = rotation seam (versioned key map + re-wrap).
  - **Named unguarded-bootstrap path** (`@profitily/db` `createUnscopedClient()`) —
    closes the TASK-009 deferral. **ESLint-gated** (`UNSCOPED-BOOTSTRAP-OK` marker
    required); sole production caller = `BootstrapPrismaService` (provisioning).
  - **OAuth module** (`apps/api/src/shopify-auth`): `GET /auth/shopify/install` (validate
    shop, signed HttpOnly SameSite=Lax state cookie, redirect) + `GET /auth/shopify/callback`
    (**verify shop-format → HMAC (timing-safe) → state, fail-closed**, then token exchange
    → shop read → provision). Shopify calls behind an **injectable client** (stubbed in
    tests). All boundaries **zod-validated**.
  - **Provisioning** (M01): idempotent upserts `Store` (encrypted token, `baseCurrency`/
    `country` from Shopify shop — ADR 0001), owner `User`, `Membership(OWNER)`; emits
    `store.installed` (thin logger seam, no consumer yet).
  - Config: `SHOPIFY_API_VERSION` (default `2026-04`) added; scopes
    `read_orders,read_products,read_customers` (least-privilege). `.env.example` updated.
- **Security (the deliverable):** **token encrypted at rest** — integration test asserts
  the DB column is not and does not contain the plaintext (`v1:` blob; decrypts back) and
  nothing logs the token (bind-down 1); HMAC+state verified before any side effect
  (bind-down 2, each rejection path tested — no exchange/DB write on failure); master key
  only via config; unguarded bootstrap narrowly named + lint-gated (bind-down 3).
- **Tests:** crypto unit 9; HMAC/state/shop-domain unit 18; controller verify-order 7
  (each fail-closed path); **install integration (real-PG, db-gated)** 2 (encrypted
  persist + idempotent re-install, counts unchanged); ESLint RuleTester proves the
  `createUnscopedClient` gate. lint 8/8 (0 err), typecheck 11/11, build 7/7, full `pnpm
  test` green on real PG (alt port 5433; markopz held 5432).
- **App URL root entrypoint (follow-up):** live install surfaced that Shopify first hits
  the App URL root (`GET /`) with `?shop=&hmac=&host=&timestamp=`, which 404'd. Added
  `RootController` (`GET /`): `shop` present → verify shop-format → HMAC (reusing the
  same helpers, no duplicated crypto) → redirect into `/auth/shopify/install`; no `shop`
  → neutral 200 landing. Funnels into the single OAuth flow (state still minted in
  install); an already-installed shop will branch to the embedded UI here at TASK-011.
- **OAuth state cookie attributes (follow-up):** live install reached the callback (HMAC
  ✓, code granted) but failed the state check — the cookie was `SameSite=Lax` (plan flaw),
  so it wasn't sent back on the **cross-site** OAuth return (and any third-party/embedded
  leg). Fixed to **`SameSite=None; Secure; Partitioned` (CHIPS) + HttpOnly** on
  staging/prod (NODE_ENV != `development`), with a relaxed `Lax`/non-secure fallback for
  local HTTP dev only. `statesMatch`/HMAC/exchange/crypto unchanged. A supertest e2e
  asserts the emitted `Set-Cookie` header contains `SameSite=None; Secure; Partitioned;
  HttpOnly` (staging NODE_ENV=`production`).
- **Direction (TASK-011):** migrate to Shopify **managed installation + token exchange**;
  this legacy authorization-code-grant cookie fix is the interim correct fix for the
  flow we built.
- **⚠️ Live verification (bind-down 5) — pending planner re-test after deploy:** with the
  root entrypoint + cookie fix in place the handshake should complete end-to-end (`/` →
  verify → `/auth/shopify/install` → authorize → callback → **state matches** → token
  exchange → persisted encrypted → `baseCurrency` read). The executor cannot drive a
  browser/dev-store install, so the live confirmation is the planner's to run; everything
  locally verifiable is green.
- **Backlog notes (bind-down 4 — direction only, not built):**
  1. **Sync/integration layer (TASK-020+) should default to GraphQL.** Shopify is
     freezing REST for new fields; the single install-time `shop.json` REST read here is
     acceptable, but the data-ingestion client should be GraphQL-first.
  2. **Expiring offline tokens are required for public apps from 2027-01-01.** Token
     storage will need an **expiry/refresh seam** (store token expiry + refresh flow)
     before then — not built now.
- **Repo config:** no `shopify.app.toml` in the repo → the Dev Dashboard is the source of
  truth (nothing to reconcile); noted.

---

## Module completion matrix

| Module | Status | Tasks | Key tables | Security verified | Tests |
|---|---|---|---|---|---|
| M00 Platform / Shared | in progress | TASK-001 (done), 002 (done), 004 (done; api skeleton/config/logging/error/OTel), 006 (done; CI gate + security scans), 004b (REVIEW; api prod build + Railway staging — deploy manual/pending), 007–009 | — | eslint-plugin-security active; engine-strict; frozen lockfile; local-only dev creds; secret-safe env validation; pinned images; Pino redaction (no PII/bodies); generic error bodies; helmet; **CI: Gitleaks + pnpm audit (high) + OSV + Semgrep; multer DoS patched via override**; Railway secrets user-set (none in repo) | sanity + env-loader (15 Vitest) green; smoke green; /health 200 + error-filter (apps/api); **built api boots DB-free, /health 200**; **DB suites force-run in CI**; static gates green |
| UI surfaces (apps/web, apps/shopify-app) | shell built | TASK-005 (skeletons), 008 (REVIEW; shell + tokens + state/money primitives + RTL/axe/visual harness); pages fill in Phase 6 | — | auth = isolated marked stub (TASK-010/011); no secrets/`.env` keys; no DB/API access; Polaris/Tailwind split structural; **shell axe-clean (incl. contrast); profit/loss not colour-only** | RTL (web 11 + shopify 1) + vitest-axe in PR gate; @axe-core/playwright + Playwright visual + smoke (web/shopify-app) nightly; tokens from `design/tokens/tokens.json` |
| Test harness (`@profitily/test-support`, `packages/core` scaffold) | wired | TASK-007 (REVIEW); fills with real engine/integration tests at TASK-050/013/021/022 | — | docker-gate force-runs in CI (no silent skip); synthetic data only; pinned images; ssh2/cpu-features native builds disabled (socket Docker) | `test:int` (3 proofs, Docker-gated), `test:contract` (Pact), `test:mutation` (Stryker), `test:load` (k6), fast-check property + **core 100%/4-metric coverage**; nightly workflow runs heavy suites |
| M01 Identity & Tenancy | in progress | TASK-003 (done), 004 (done; tenant guard), 009 (REVIEW; raw + nested boundaries closed), 010 (REVIEW; store/owner provisioning at install) | Store, User, Membership, Subscription | **fail-closed tenant isolation** (Prisma extension + ALS context); read + write-path scoping; **raw SQL refused on guarded client + ESLint-banned repo-wide**; **nested tenant writes rejected**; **provisioning via lint-gated unguarded bootstrap only**; no PII; store-scoped cascades | migration tests (clean + on-existing) + **tenant-isolation suite (22 cases incl. write-path, raw, nested)** + ESLint raw-ban/bootstrap RuleTester green; **force-run in CI** (no silent skip); SKIPPED locally w/o DB |
| M02 Shopify Integration | in progress | TASK-010 (REVIEW; OAuth install + encrypted token); webhooks/sync → 013/020+ | Store (token/currency at install) | **OAuth state + HMAC verified fail-closed before any side effect** (timing-safe); **access token AES-256-GCM encrypted at rest** (never plaintext/logged); least-privilege scopes; zod at every boundary; `baseCurrency` from Shopify (ADR 0001) | crypto unit (9) + HMAC/state/shop-domain (18) + controller verify-order (7) + **install integration real-PG (encrypted persist + idempotent re-install)**; live dev-app install flagged for planner |
