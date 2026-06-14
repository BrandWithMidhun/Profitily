# CLAUDE.md — Executor Instructions for Claude Code

> Read this at the start of **every** session. It is the contract between the
> **planner/reviewer** (a separate Claude conversation) and **you, the executor
> (Claude Code)**. The planner writes a **Build Request** (see
> `docs/templates/BUILD-REQUEST.md`); you implement it on a branch and open a PR.
> Keep this file current when conventions change.

---

## 1. Product in one paragraph

**Profitily AI** — an AI CFO for Shopify / DTC brands. It ingests Shopify, shipping,
ad-platform, and merchant-entered cost data, computes **true profit** at store /
product / variant / order / campaign / customer grain, and layers AI agents,
recommendations, and alerts on top. Specs live in `docs/`. The profit math in
`docs/06-PROFIT-ENGINE.md` is authoritative.

## 1a. Operating principles (highest priority — apply to everything)
- **Strong security, always.** Follow `docs/13-SECURITY.md`. Tenant isolation, token
  encryption, input validation, least privilege, and webhook verification are
  non-negotiable and never cut for speed.
- **No over-engineering.** Build the simplest thing that meets the spec + acceptance
  criteria (`docs/14 §1`). No speculative features, no premature abstraction/
  optimization, no configurability "just in case." Boring and proven beats clever.
- **Best practices only** (`docs/14 §2`): small typed units, pure core, explicit error
  handling, module boundaries, tests in the same PR.
- **Stop and flag — don't guess.** If anything is ambiguous, conflicting, risky, or
  tempts work outside the spec, **STOP**, raise a flag (`docs/templates/FLAG.md`,
  `docs/14 §4`), and wait for the planner's review before continuing. A correct early
  flag is success; a wrong silent guess is a defect.

## 2. Cost philosophy (important)

This project is built **open-source-first and self-hostable** to keep paid-tool
usage near zero during development. Defaults below are all free/OSS. Only reach for a
paid/managed service when the planner approves it via an ADR. See
`docs/03-TECH-STACK.md` for the full free-vs-paid breakdown.

## 3. Tech stack (do not deviate without an ADR)

| Layer | Default (free / OSS) | Paid only if approved |
|---|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind; Polaris in shopify-app | — |
| Backend | NestJS, TypeScript | — |
| Primary DB | PostgreSQL | managed PG (RDS/Neon) at scale |
| Time-series / analytics | **TimescaleDB** extension on Postgres (continuous aggregates) | ClickHouse only at large scale |
| Cache | Redis (or **Valkey**, OSS fork) | — |
| Queue | BullMQ (on Redis) | — |
| Object storage | **MinIO** (S3-compatible, self-hosted) | Cloudflare R2 / S3 in prod |
| Auth | Passport + JWT + OAuth 2.0 (self-implemented) | Clerk/Auth0 — avoid |
| AI | **Ollama (Llama 3.x) local** for simple tasks; route to Claude/OpenAI only for complex reasoning, with response caching | metered API calls (minimize) |
| Email | Nodemailer + SMTP (Mailpit locally) | provider free tier later |
| Observability | OpenTelemetry + Prometheus + Grafana + Loki | Datadog — avoid |
| Error tracking | **GlitchTip** (Sentry-compatible, OSS) | hosted Sentry — avoid |
| CI | GitHub Actions (free tier) | — |
| Hosting | local Docker (dev) | **Railway** (staging/prod) — accepted host; see `docs/12` |
| Monorepo | pnpm workspaces + Turborepo | — |

> Rule: prefer a library/extension over a new managed service. Adding any paid
> dependency requires an ADR in `docs/adr/`.

## 4. Repository layout

```
profitily-ai/
├── apps/
│   ├── shopify-app/   # embedded Shopify app: OAuth, billing, webhooks, setup wizard
│   ├── web/           # main SaaS dashboard (Next.js)
│   └── api/           # NestJS: REST + workers (same code, separate entrypoints)
├── packages/
│   ├── db/            # Prisma schema, migrations, seed (single source of DB truth)
│   ├── core/          # profit/cost/shipping/allocation engines — PURE TS, no I/O
│   ├── integrations/  # Shopify, Shiprocket, Shipway, Delhivery, Meta, Google, TikTok
│   ├── ai/            # agents, prompts, tool schemas, model router (Ollama-first)
│   ├── shared/        # types, DTOs, zod schemas, Money, utils
│   └── config/        # eslint, tsconfig, tailwind, vitest presets
├── docs/              # specs, plan, templates (read first)
└── tooling/           # docker-compose for local infra, scripts
```

Pure business logic (money math) lives in `packages/core` with **zero I/O** so it is
fully unit- and property-testable. Apps/workers call into it.

## 5. The build loop (see `docs/09-WORKFLOW.md` for the full process)

Seven steps per task; you never self-approve:
1. **Planning Prompt** (planner → you) → 2. you return an **Implementation Plan**
   (`docs/templates/IMPLEMENTATION-PLAN.md`), **no code yet** → 3. planner reviews the
   plan → 4. planner sends a **Build Request** (`docs/templates/BUILD-REQUEST.md`) →
   5. you **build + test** on `task/TASK-XXX-slug` → 6. you return a **Build Summary +
   Test Report** (`docs/templates/BUILD-SUMMARY.md`) + open a PR
   (`docs/templates/PR-REVIEW.md`) → 7. planner reviews; changes → iterate on the same
   branch; approved → merge → next task.

Within step 5: TDD for `packages/core` and pure logic; meet every test requirement in
the request (`docs/08-TESTING.md`); run all quality gates (section 7) and state which
passed; update `docs/*` and this file in the same commit if schema/API/conventions
changed.

**UI tasks:** before implementing, read `docs/11-UI-DEVELOPMENT.md` for the page spec
**and** the matching drop in `design/<surface>/<slug>/`. Use the `frontend-design`
skill + tokens from `design/tokens/`. Implement loading/empty/error states; add
component (RTL), E2E (Playwright), axe a11y, and a visual snapshot. If the drop
conflicts with the spec's data contract, implement the contract and flag the mismatch.

## 6. Git & commits

- **Branch model:** long-lived `main` (→ Railway **production**) and `develop` (→ Railway
  **staging**). Feature work branches off `develop`: `task/TASK-012-shopify-oauth`,
  `fix/...`, `chore/...`, `test/...`. **PRs target `develop`, never `main` directly.**
  Merging to `develop` auto-deploys staging (CI-gated); releases promote `develop→main`.
- **Conventional Commits:** `feat(api): ...`, `fix(core): ...`, `test(core): ...`,
  `docs: ...`, `chore(db): ...`.
- Atomic commits; no "wip"/"misc" dumps. Check `git status` before every commit.
- **Never commit** `.env`, secrets, `node_modules`, build output, or real merchant data.

## 7. Quality gates (all must pass before "done")

```bash
pnpm lint          # eslint (incl. security rules) — 0 errors
pnpm typecheck     # tsc --noEmit across workspace
pnpm test          # unit + integration; packages/core stays 100% green
pnpm test:e2e      # Playwright (when the task touches a user flow)
pnpm build         # all apps compile
```
A task is **not done** until the gates pass **and** acceptance criteria are met.

## 8. Hard rules / guardrails

- **Tenant isolation is sev-1.** Every tenant query MUST be scoped by `storeId` via
  the Prisma tenant extension. A cross-tenant leak fails review automatically. There
  is a dedicated isolation test suite — extend it for new tenant tables.
- **Money = `BigInt` minor units + currency code.** Never floats. Use the `Money`
  helper. Integer splits use largest-remainder so parts sum exactly.
- **Idempotency:** every webhook/sync handler is idempotent (dedupe by
  `storeId:source:externalId:eventId`). Shopify redelivers.
- **Secrets via typed config only.** New secret → add a placeholder to `.env.example`
  and document it; never hardcode.
- **AI cost control:** default to the local Ollama model; only escalate to a paid API
  when the router's complexity threshold is met; cache responses keyed by inputs.
- **No scope creep.** If a request implies work not in `docs/`, raise it as a new task
  instead of building it.
- **Ask before destructive ops** (dropping tables, deleting migrations, force-push).
- **Security is mandatory** — follow `docs/13-SECURITY.md`; validate all input, encrypt
  tokens, default-deny authz, verify webhooks, no secrets/PII in logs.
- **Don't over-engineer** — `docs/14`; simplest correct solution, no speculative work.
- **When unsure, stop and flag** (`docs/templates/FLAG.md`) instead of guessing.

## 9. Local infra

`docker compose -f tooling/docker-compose.yml up -d` → Postgres+TimescaleDB, Redis,
MinIO, Mailpit, and Ollama. Copy `.env.example` → `.env`. `pnpm db:migrate`,
`pnpm db:seed`. Everything runs locally with no paid account.

## 10. Status

`docs/07-PROJECT-PLAN.md` holds the phase/task board and the `ACTIVE TASK` marker.
Start there.
