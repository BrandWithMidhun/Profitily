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

## 7. Environments & CI/CD
- Use Railway **environments**: `staging` and `production` (separate Shopify app creds,
  separate DBs).
- **Deploys:** GitHub integration auto-deploys on push to the mapped branch
  (`main`→staging, tag/`release`→production), or use the **Railway CLI** from GitHub
  Actions after CI passes. Gate production deploys on green CI (the pipeline in
  `docs/08 §5`).
- **Secrets:** set in Railway per environment (never in the repo). Mirror the keys in
  `.env.example`. Generate `api`/`web`/`shopify-app` public domains under Settings →
  Networking.

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
- [ ] Production deploy gated on green CI; secrets set in Railway, not in git.
- [ ] OSS observability shipping (OTel→Prometheus/Grafana/Loki; GlitchTip).
