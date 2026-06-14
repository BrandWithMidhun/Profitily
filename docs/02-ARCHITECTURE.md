# 02 — System Architecture

## 1. Shape

Two product surfaces, one backend, one pure-logic core, an all-OSS infra plane.

```
        Merchant
        │  embedded (Polaris)          │ redirect / SSO
   ┌────▼──────────────┐        ┌──────▼───────────────┐
   │ apps/shopify-app  │        │       apps/web        │
   │ OAuth·billing·    │        │  dashboards·reports·  │
   │ webhooks·wizard   │        │  AI hub·alerts        │
   └────┬──────────────┘        └──────┬───────────────┘
        │            REST / typed API   │
        └───────────────┬───────────────┘
                        │
            ┌───────────▼─────────────┐
            │        apps/api         │   NestJS (REST + BullMQ workers)
            │  ┌───────────────────┐  │
            │  │  packages/core    │  │   pure profit/cost/alloc math (no I/O)
            │  └───────────────────┘  │
            └──┬────────┬───────┬──────┘
               │        │       │
   ┌───────────▼┐ ┌─────▼────┐ ┌▼─────────┐ ┌──────────┐ ┌──────────┐
   │ PostgreSQL │ │ Redis/   │ │ BullMQ   │ │ MinIO    │ │ Ollama   │
   │ +Timescale │ │ Valkey   │ │ (queues) │ │ (S3 OSS) │ │ (local AI│
   │ (truth +   │ │ (cache)  │ │          │ │ reports) │ │  default)│
   │ analytics) │ └──────────┘ └──────────┘ └──────────┘ └────┬─────┘
   └────────────┘                                              │ escalate only
                                                               ▼
                                                   Claude / OpenAI (metered, minimized)

   packages/integrations (async, sandbox tiers): Shopify · Shiprocket · Shipway ·
   Delhivery · Shopify Shipping · Meta · Google · TikTok
   Observability: OpenTelemetry → Prometheus + Grafana + Loki · GlitchTip (errors)
```

## 2. Why this stack stays cheap
- **One database engine.** Postgres + the **TimescaleDB** extension covers both the
  transactional source of truth and time-series profit aggregates (continuous
  aggregates / materialized views). No separate analytics service to pay for or
  operate. ClickHouse is deferred to a documented scale threshold (see
  `docs/03-TECH-STACK.md`).
- **Self-hosted object storage** (MinIO) is S3-API-compatible, so swapping to R2/S3
  later is a config change, not a rewrite.
- **Local-first AI.** A model router prefers a local Ollama model and only escalates
  to a paid API for genuinely complex reasoning, with response caching.
- **OSS observability** (OTel/Prometheus/Grafana/Loki/GlitchTip) instead of paid APM.

## 3. Components
- **apps/shopify-app** — embedded Next.js + Polaris. OAuth handshake, Shopify managed
  billing, webhook registration/receipt, 7-step wizard. Thin: writes config, triggers
  syncs, redirects to web.
- **apps/web** — Next.js App Router + Tailwind. All analytics, drill-downs, AI hub,
  reports, alerts, settings. Reads pre-aggregated metrics for fast loads.
- **apps/api** — NestJS REST + worker entrypoints. Auth, tenant resolution, CRUD,
  sync orchestration, profit computation, AI endpoints, alert eval, reports. Math →
  `packages/core`.
- **packages/core** — pure TS engines (profit, cost, shipping rules, allocation,
  `Money`). 100% unit/property tested. The correctness boundary.
- **packages/integrations** — one client per external system, common interface
  (`authenticate`, `backfill`, `handleWebhook`, `normalize`). Provider quirks isolated.
- **packages/ai** — agents (Profit/Marketing/Inventory/Forecast/CFO), prompts,
  read-only grounding tools, Ollama-first model router.
- **packages/db** — Prisma schema/migrations/seed; single DB source of truth.

## 4. Data flow (order → profit)
1. Shopify webhook → HMAC verify → idempotent BullMQ enqueue (`storeId`+event id).
2. Worker normalizes & persists order to Postgres.
3. Resolve costs: product (temporal), packaging, payment fee, shipping (actual if
   synced else rule engine), allocated ad spend, amortized opex.
4. `packages/core` computes order/variant/product/store profit deterministically.
5. Write component-level `ProfitSnapshot` rows; Timescale continuous aggregates roll
   them up for dashboards.
6. Evaluate alert rules; refresh recommendations.

## 5. Multi-tenancy
- Shared DB, **row-level isolation by `storeId`** on every tenant table, enforced by a
  Prisma client extension that injects the filter and rejects unscoped tenant queries.
- Per-store encrypted OAuth tokens/keys (envelope encryption with a master key from
  secrets/KMS).
- Timescale hypertables partitioned with `storeId` in the composite key; queries
  always filter on it.
- Agency = one user → many stores via `Membership`.

## 6. Async & reliability
- All external I/O runs in BullMQ jobs with retry + exponential backoff + DLQ.
- Idempotency key `storeId:source:externalId:eventId`; redelivered events are no-ops.
- Backfills are chunked, cursor-resumable per store/source.
- Per-store sync health (last success, lag, error rate) surfaced in settings.

## 7. AI request path
Dashboard question → API AI endpoint → `packages/ai` picks agent → agent calls
read-only tools to fetch **engine-computed** numbers (never recomputes money) → model
router runs local Ollama or escalates to a paid API by complexity → grounded answer +
optional recommendation. Responses cached by input hash.

## 8. Environments
- **Local:** Docker Compose (PG+Timescale, Redis/Valkey, MinIO, Mailpit, Ollama) +
  Shopify dev store + a tunnel (cloudflared/ngrok) for webhooks. Zero paid accounts.
- **Staging/Prod:** same images self-hosted, or swap MinIO→R2 and Ollama-escalation→
  managed API via config. Promote paid services only with an ADR.

## 9. Cross-cutting decisions (record deviations as ADRs)
Money = `BigInt` minor units + currency · pure math in `packages/core` · Postgres+
Timescale before ClickHouse · OSS observability · local-AI-first routing.
