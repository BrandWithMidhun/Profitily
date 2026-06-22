# 0002 — Railway as the hosting provider (staging first, api service)

- **Status:** Accepted
- **Date:** 2026-06-22
- **Deciders:** planner, reviewer

## Context
Local development is 100% free/OSS via Docker Compose (`docs/12`). We need a hosted
environment to run the platform for staging (and later production). Per `docs/03` cost
philosophy, any paid/managed service requires an ADR. Railway was already named as the
accepted host in `docs/12`; this ADR formally records the adoption as we make the first
real deploy (TASK-004b: the `apps/api` service + its database to staging).

## Decision
- **Railway is the accepted paid host** for staging and production. First deploy scope is
  **the `apps/api` service + a TimescaleDB database**, in a **`staging`** environment that
  auto-deploys from **`develop`** (CI-gated via "Wait for CI", `docs/12 §7`).
- **api** is built as a precompiled ESM artifact (`pnpm build` → `dist`, run with
  `node apps/api/dist/main.js`) via **Nixpacks** + a committed `apps/api/railway.json`
  (build/start/pre-deploy-migrate/`/health` healthcheck). No Dockerfile.
- **Database:** `timescale/timescaledb:2.17.2-pg16` as a Railway service with a **1 GB
  persistent volume** (growable). It is **private** (no public domain); only `api` gets a
  public domain.
- **Not provisioned now:** Redis/Valkey and MinIO — nothing uses BullMQ or object storage
  yet. `web`/`shopify-app` join staging at TASK-005.

## Cost shape
Usage-based: a small monthly minimum plus **per-second compute** and **per-GB volume
storage** (no per-seat fees). Free trial credit to start. Cost is kept low by running only
the api + a 1 GB Timescale volume at staging; services scale independently and unused
preview environments are turned off. Estimate/track before production (`docs/12 §9`).

## Consequences
- Secrets live in **Railway env per environment** (never in git); keys are mirrored as
  placeholders in `.env.example`. Real secrets (`JWT_SECRET`, `ENCRYPTION_KEY`) are
  user-generated and set in Railway only.
- The pre-deploy step runs `prisma migrate deploy`; **`prisma` is a runtime dependency of
  `@profitily/db`** so it survives any production devDep prune (`@swc/cli`/`typescript`
  are build-time only).
- Migrations must remain backward-compatible (expand-then-contract) so app-code rollback
  is safe against an already-migrated DB (`docs/12 §7`).

## Reversibility
Lock-in is deliberately limited: storage and AI stay behind **config-swappable adapters**
(MinIO↔R2/S3 via `S3_*`; Ollama↔metered API via the router), and the DB is standard
Postgres+Timescale. Moving off Railway is a redeploy of the same images/build elsewhere,
not a rewrite.

## Alternatives considered
- **Self-host (Coolify/VPS):** more ops burden for a small team now; revisit at scale.
- **Per-app Dockerfiles instead of Nixpacks:** rejected for now (more to maintain);
  reserved as a fallback only if the Nixpacks pnpm-workspace build proves unworkable.
- **Provisioning Redis/MinIO immediately:** rejected — unused; adds cost/ops with no
  consumer yet.
