# 03 — Tech Stack & Cost Philosophy

## 1. Principle: open-source-first, self-hostable, paid-only-when-justified

Every default below is free / OSS and runs locally via Docker. The goal is to build
and operate the entire platform with **near-zero paid-tool usage** until real scale or
production hardening makes a managed service worth it — and even then, swaps are
config-level, not rewrites. **Adding any paid dependency requires an ADR.**

## 2. Stack by layer

### Frontend
- **Next.js (App Router) + React + TypeScript** — `apps/web` and `apps/shopify-app`.
- **Shopify Polaris** — embedded app UI (required for Shopify look-and-feel).
- **Tailwind CSS** — main SaaS styling.
- **TanStack Query** — server-state/data fetching. **Recharts** — charts (OSS).
- **zod** — runtime validation shared with backend via `packages/shared`.

### Backend
- **NestJS + TypeScript** — REST API and worker processes (one codebase, separate
  entrypoints).
- **Prisma** — ORM + migrations (`packages/db`).
- **BullMQ** — job queues on Redis. **Pino** — structured logging.
- **Passport + JWT + OAuth 2.0** — auth, self-implemented (no paid auth SaaS).

### Data
- **PostgreSQL** — transactional source of truth (OSS).
- **TimescaleDB extension** — time-series profit snapshots + continuous aggregates for
  dashboards. Keeps us on **one** database engine.
- **Redis** (or **Valkey**, the OSS Redis fork) — cache + BullMQ backend.
- **MinIO** — S3-compatible object storage for reports/CSV exports (self-hosted).

### AI
- **Ollama** running **Llama 3.x** locally — default for classification, routing,
  summaries, simple agent answers (free).
- **Model router** in `packages/ai` — escalates to **Claude / OpenAI** only when a
  task crosses a complexity threshold (e.g. CFO-level multi-step reasoning), with
  **response caching** keyed by input hash to avoid repeat spend.
- Agents never compute money; they read engine outputs (keeps answers consistent and
  cheap).

### Integrations (external, sandbox/dev tiers are free)
Shopify (Admin API + webhooks), Shiprocket, Shipway, Delhivery, Shopify Shipping,
Meta Ads, Google Ads, TikTok Ads. Use each provider's **sandbox / dev app** during
build; production API usage is metered by the provider, not by us.

### Tooling & quality
- **pnpm workspaces + Turborepo** — monorepo + task caching.
- **ESLint** (+ `eslint-plugin-security`), **Prettier**, **TypeScript strict**.
- **Vitest** (unit), **Supertest + Testcontainers** (integration), **Playwright**
  (e2e/visual/a11y), **fast-check** (property), **Stryker** (mutation), **k6** (load),
  **Pact** (contract), **Semgrep / CodeQL / Gitleaks / OSV-Scanner / npm audit /
  OWASP ZAP** (security). All OSS — see `docs/08-TESTING.md`.

### Ops & observability (OSS)
- **OpenTelemetry** → **Prometheus** (metrics) + **Grafana** (dashboards) + **Loki**
  (logs).
- **GlitchTip** — Sentry-compatible error tracking, self-hosted.
- **GitHub Actions** — CI (free tier). **Docker Compose** — local infra.
- **Mailpit** — local SMTP capture for emails/reports.

## 3. Free vs paid — explicit table

| Need | Free / OSS default (use this) | Paid option (defer; ADR required) | Trigger to consider paid |
|---|---|---|---|
| Database | Postgres (Docker) | Neon / RDS / Supabase | Prod HA, backups at scale |
| Analytics store | Timescale on Postgres | ClickHouse (managed) | >5–10M snapshot rows/store or slow rollups |
| Cache/queue | Redis/Valkey (Docker) | Upstash / ElastiCache | Prod managed Redis |
| Object storage | MinIO (self-host) | Cloudflare R2 / S3 | Prod durability/CDN |
| AI inference | Ollama (local) | Claude / OpenAI | complex reasoning only, cached |
| Auth | Passport+JWT (self) | Clerk / Auth0 | never planned; avoid |
| Email | Nodemailer+SMTP / Mailpit | SES / Postmark free tier | prod deliverability |
| Error tracking | GlitchTip (self-host) | Sentry SaaS | optional convenience |
| APM/observability | OTel+Prometheus+Grafana+Loki | Datadog / New Relic | avoid |
| CI | GitHub Actions free | paid runners | heavy parallel CI |
| Hosting | local Docker / Coolify (OSS PaaS) | **Railway** (chosen host) | staging/prod — see `docs/12` |

> **What stays inherently metered:** Shopify/ad/shipping provider production API calls
> and (only if escalated) Claude/OpenAI tokens. Both are minimized by design (caching,
> batching, local-first AI) — they are not subscriptions we control here.

## 4. Cost-minimization practices (enforced in code review)
1. **Cache external + AI calls.** Idempotent reads cached in Redis with TTL; AI
   responses cached by input hash.
2. **Batch & backoff.** Sync jobs batch requests and respect provider rate limits to
   stay inside free/sandbox quotas.
3. **Local-first AI routing.** Escalate to paid models only past the complexity
   threshold; log every escalation with a reason for cost visibility.
4. **One engine over many services.** Prefer a Postgres extension or library to a new
   managed service.
5. **Config-swappable adapters.** Storage (MinIO↔S3) and AI (Ollama↔API) sit behind
   interfaces so going paid is a flag, never a refactor.
6. **Track spend.** A lightweight cost log records external/AI call counts per store
   for observability and tier enforcement.

## 5. Versioning policy
Pin major versions in `package.json`; renovate/Dependabot for security bumps. Node
floor `>=22` (enforced via `engine-strict`); the project standardizes on **Node 24**
via `.nvmrc`. pnpm 9+ (the repo pins **11.x** through the `packageManager` field).
TypeScript strict. Record any stack change as an ADR.
