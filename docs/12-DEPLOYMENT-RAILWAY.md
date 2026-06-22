# 12 — Deployment (Railway)

Hosting target is **Railway**. Local dev stays 100% free/OSS (Docker Compose); Railway
is the accepted paid host for staging/production, billed by usage (per-second, no
per-seat). This doc maps the architecture onto Railway services.

> Reliability note: keep automated DB backups on, and treat Railway as one provider —
> the storage/AI adapters stay config-swappable (MinIO↔R2, Ollama↔API) so we're never
> locked in. Record the move to Railway as an ADR.

## 1. Project topology (one Railway project, multiple services)

```
Railway project: profitily-ai (env: staging | production)
├── svc: web            (apps/web — Next.js)            public domain
├── svc: shopify-app    (apps/shopify-app — Next.js)    public domain (Shopify app URL)
├── svc: api            (apps/api — NestJS REST)        public domain
├── svc: worker         (apps/api — BullMQ workers)     private only (start: worker entry)
├── svc: cron-reports   (apps/api — report job)         Cron Schedule, runs & exits
├── db:  timescaledb    (timescale/timescaledb image)   volume (Postgres + Timescale)
└── db:  redis          (Railway Redis)                 private
```

All services talk over **private networking**; only web/shopify-app/api expose public
domains. `api` and `worker` share `redis` for the BullMQ queue (no direct api↔worker
link needed).

> **Two environments, branch-mapped:** the `staging` environment's services deploy from
> **`develop`**, the `production` environment's from **`main`** (see §7).

## 2. Databases on Railway
- **Postgres + TimescaleDB:** deploy the **TimescaleDB template/image**
  (`timescale/timescaledb:*-pg16`) as a service with a **persistent volume** — it's
  Postgres with the extension preinstalled, so our schema + hypertables + continuous
  aggregates work unchanged. (Plain Railway Postgres would not have Timescale.)
- **Redis:** add from the UI (`+ New → Database → Redis`).
- Expose both to services via **reference variables**: `DATABASE_URL` (from Timescale
  service), `REDIS_URL` (from Redis). Set these on `api`, `worker`, and `cron-reports`.

## 3. Monorepo build (pnpm + Turborepo)
Railway auto-detects a pnpm monorepo and can stage a service per deployable package,
but for a multi-app repo the **robust pattern is one service per app with an explicit
config**:
- Per service set **Root Directory** = repo root and a **build/start command** that
  filters the package, e.g.
  - build: `pnpm install --frozen-lockfile && pnpm --filter @profitily/api build`
  - start: `pnpm --filter @profitily/api start`
- Add **Watch Paths** so a change in one app doesn't rebuild the others (Jan-2026
  focused PR environments also deploy only touched services).
- Prefer **`railway.toml` per app** (config-as-code) or **per-app Dockerfiles** for
  full control over the pnpm workspace build. Worker reuses the `api` build with a
  different start command (`pnpm --filter @profitily/api start:worker`).

## 4. Migrations
Set a **pre-deploy command** on `api` to run migrations before each release:
```
pnpm --filter @profitily/db migrate:deploy && <timescale-sql-step-if-needed>
```
Migrations must be backward-compatible during rolling deploys (expand-then-contract).

## 5. Object storage & AI in production
- **Object storage:** MinIO can run as a Railway service + volume for a cheap start,
  but for production durability use **Cloudflare R2 / S3** — it's the same S3 API, so
  only the `S3_*` env vars change. Decide via ADR.
- **AI:** Railway has **no GPU**, so local-style Ollama inference is slow/expensive
  there. In production, either keep light tasks on a small CPU model or (recommended)
  let the router **escalate to the metered API** for real work, with caching. Dev stays
  on local Ollama. This keeps paid AI usage minimal and explicit.

## 6. Scheduled work
- **Reports** (daily/weekly/monthly): a **Cron Job service** (`cron-reports`) with a
  crontab in Settings → Cron Schedule (min granularity every 5 min, UTC). It runs the
  report task and exits.
- **Continuous data jobs** (sync, snapshot recompute, alert eval): **BullMQ repeatable
  jobs** in the always-on `worker` service — not cron — so they retry and scale.

## 7. Git → Railway auto-deploy (CI-gated)

**Branch model → environment mapping:**

| Git branch | Railway environment | Trigger | Gate |
|---|---|---|---|
| `develop` | **staging** | auto-deploy on **every merge** to `develop` | **Wait for CI** (GitHub Actions must pass) |
| `main` | **production** | auto-deploy on merge/promotion to `main` | **Wait for CI** + green required checks |

Flow: feature branch `task/TASK-XXX` → PR into **`develop`** → CI runs → on merge,
Railway auto-deploys `develop` to **staging**. Releases promote `develop → main` (PR or
fast-forward) → Railway auto-deploys **production**. This is the "merge to develop =
auto-deploy" pipeline.

### Branch protection (GitHub) — required for "Wait for CI"

The CI workflow (`.github/workflows/ci.yml`, TASK-006) runs on PRs into **and** pushes
to **both `develop` and `main`** (so the `develop→main` release PR is gated and Railway's
`main`→production "Wait for CI" has checks to wait on). Branch protection is a **GitHub
repo setting** (not enforceable from the workflow); a maintainer applies it to **`develop`
and `main`**:

- **Require a pull request before merging** (no direct pushes).
- **Require status checks to pass** — required checks: **`verify`** and **`security`**
  (the two CI jobs); enable **"Require branches to be up to date"** (strict).
- Recommended: require ≥1 approving review; include administrators.

Optional `gh` snippet (run per branch; illustrative — adjust reviews/admins to taste):

```bash
for BRANCH in develop main; do
  gh api -X PUT "repos/{owner}/{repo}/branches/$BRANCH/protection" \
    --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify", "security"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null
}
JSON
done
```

Without these checks marked **required**, Railway's "Wait for CI" cannot reliably gate a
deploy (a deploy could proceed on an unchecked commit).

### One-time wiring (per environment, per service)
1. **Connect the repo:** install the **Railway GitHub App** on the repo (needs a
   project member with contributor access).
2. **Set each service's connected branch** to the environment's branch: services in the
   `staging` environment → `develop`; services in `production` → `main`. Railway
   auto-deploys on push to that branch.
3. **Enable "Wait for CI"** in each service's settings so Railway holds the deploy in
   `WAITING` until GitHub Actions succeed, and **SKIPS** it if any workflow fails.
   ⚠️ Wait-for-CI checks **all** GitHub check suites on the commit — remove stale/old
   check apps so an unrelated failing check can't block deploys.
4. **Set Watch Paths** per service (e.g. `apps/api/**`, `packages/**`) so a change to
   one app doesn't rebuild the others (works with focused PR environments).
5. **Config-as-code:** commit a `railway.json`/`railway.toml` per app (overrides
   dashboard). Example `apps/api/railway.json`:
   ```json
   {
     "$schema": "https://railway.com/railway.schema.json",
     "build": { "buildCommand": "pnpm install --frozen-lockfile && pnpm --filter @profitily/api build" },
     "deploy": {
       "startCommand": "pnpm --filter @profitily/api start",
       "preDeployCommand": "pnpm --filter @profitily/db migrate:deploy",
       "healthcheckPath": "/health",
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```
6. **Healthcheck** (`/health`) so a bad release doesn't take traffic; **restart policy**
   on failure.

### Secrets & domains
Set secrets in Railway **per environment** (never in the repo); mirror keys in
`.env.example`. Generate public domains for `web`/`shopify-app`/`api` under Settings →
Networking (one set per environment; register the staging vs prod `shopify-app` domain
in the matching Shopify app).

### Optional: deploy via GitHub Actions + CLI
If you prefer driving deploys from CI (instead of native branch auto-deploy), run
`railway up --ci --service <svc>` in a workflow after tests pass, authenticated with a
**Project Token** scoped to the target environment. Native branch auto-deploy +
"Wait for CI" is simpler and is the default for this project.

### Rollback
Re-deploy a previous deployment from the Railway dashboard, or `railway redeploy
--deployment <id>`. Migrations must be backward-compatible (expand-then-contract) so a
rollback of app code is safe against the already-migrated DB.

## 8. Shopify specifics
- The `shopify-app` public Railway domain is the app URL + webhook/OAuth callback
  registered in the Shopify Partner dashboard (per environment).
- App Bridge needs the correct host; set `SHOPIFY_APP_URL` to the Railway domain.

## 9. Cost shape (typical start)
Usage-based: free trial credit, then a small monthly minimum + per-second compute and
volume storage. Keep services right-sized; scale `worker` independently from `api`;
turn off preview environments you aren't using. Estimate and record in an ADR before
production.

## 10. Go-live checklist
- [ ] Timescale service + volume; backups enabled; hypertables/aggregates applied.
- [ ] `DATABASE_URL`/`REDIS_URL` reference vars on api/worker/cron.
- [ ] Per-app build/start + watch paths (or Dockerfiles); pre-deploy migration command.
- [ ] Object storage decided (MinIO vol vs R2/S3) via ADR; `S3_*` set.
- [ ] AI escalation configured + cached; spend logging on.
- [ ] Staging + production environments; Shopify creds + domains per env.
- [ ] **Connected branches set: `develop`→staging, `main`→production; "Wait for CI" on
      every service; watch paths per app; `railway.json` committed.**
- [ ] Production deploy gated on green CI; secrets set in Railway, not in git.
- [ ] OSS observability shipping (OTel→Prometheus/Grafana/Loki; GlitchTip).

## 11. Staging `api` — concrete config (TASK-004b, first deploy)

First real deploy: the **`api` service + a TimescaleDB database** in the `staging`
environment (auto-deploys from `develop`, CI-gated). **No Redis/MinIO** (nothing uses
them yet); web/shopify-app join at TASK-005.

**Committed config — `apps/api/railway.json`** (Nixpacks; precompiled `dist`):

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build",
    "watchPatterns": ["apps/api/**", "packages/**"]
  },
  "deploy": {
    "startCommand": "node apps/api/dist/main.js",
    "preDeployCommand": "pnpm --filter @profitily/db migrate:deploy",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Build/prune ordering (important):** `buildCommand` installs **all** deps (incl. dev) and
runs `pnpm build` (SWC for `apps/api`, `tsc` for the libs → `dist`). `@swc/cli` +
`typescript` are **build-time only**. **`prisma` is a runtime dependency of
`@profitily/db`**, so the `preDeployCommand` migrate (and any prod devDep prune) is safe.
`/health` is **liveness only** — it does not touch the DB (Prisma connects lazily), so the
service boots and stays healthy even before the DB is reachable.

**Env vars on the `api` service** — set in Railway only; keys mirror `.env.example`:

| Var | Type | Value on staging |
|---|---|---|
| `DATABASE_URL` | **REFERENCE** | reference variable from the TimescaleDB service |
| `JWT_SECRET` | **REAL-SECRET** | user-generated (≥16); never committed/printed |
| `ENCRYPTION_KEY` | **REAL-SECRET** | user-generated (≥32 bytes); never committed/printed |
| `NODE_ENV` | value | `production` |
| `API_BASE_URL` | value | the generated public api domain |
| `APP_BASE_URL` | value | staging web URL (placeholder until TASK-005) |
| `S3_ENDPOINT`/`S3_REGION`/`S3_BUCKET`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_FORCE_PATH_STYLE` | **PLACEHOLDER** | valid-format dummies (no MinIO/S3 yet; `loadEnv` validates format only) |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` | **PLACEHOLDER** | valid-format dummies (no SMTP yet) |
| `OLLAMA_URL`/`OLLAMA_MODEL`/`AI_ESCALATION_ENABLED` | **PLACEHOLDER** | valid-format dummies; `AI_ESCALATION_ENABLED=false` |

> The PLACEHOLDER vars exist only because `loadEnv` validates the whole env at boot; they
> are not used by `/health`. A follow-up will make not-yet-used subsystem env
> optional-until-used so staging eventually needs only the REAL-SECRET + REFERENCE vars.
> `prisma`'s pre-deploy migrate requires the DB to be reachable, so add the Timescale
> service (1 GB volume) **before** the api.
