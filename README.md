# Profitily AI

**Your AI CFO for eCommerce Brands.** An AI-powered Profit Intelligence Platform for
Shopify / DTC merchants that computes true profitability across store, product,
variant, order, campaign, and customer — by combining sales, product costs, shipping,
ads, packaging, refunds, fees, and operational expenses — then layers AI agents,
recommendations, and alerts on top.

> *"Know Your Real Profit. Every Order. Every Product."*

This repo is **open-source-first and self-hostable**: the default stack uses no paid
services, so you can build and run the whole platform locally for free. See
[`docs/03-TECH-STACK.md`](docs/03-TECH-STACK.md) for the free-vs-paid breakdown.

## Documentation map (read in order)

| Doc | Purpose |
|---|---|
| [`docs/01-PRD.md`](docs/01-PRD.md) | Product requirements, users, scope, success metrics |
| [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | System design, data flow, multi-tenancy, reliability |
| [`docs/03-TECH-STACK.md`](docs/03-TECH-STACK.md) | Full stack + cost philosophy + free/paid table |
| [`docs/04-DB-STRUCTURE.md`](docs/04-DB-STRUCTURE.md) | Prisma schema, SQL DDL, indexes, Timescale model |
| [`docs/05-MODULE-PLANNING.md`](docs/05-MODULE-PLANNING.md) | Bounded contexts, interfaces, dependencies |
| [`docs/06-PROFIT-ENGINE.md`](docs/06-PROFIT-ENGINE.md) | Core profit/cost/shipping/allocation math |
| [`docs/07-PROJECT-PLAN.md`](docs/07-PROJECT-PLAN.md) | Phased, task-level execution board |
| [`docs/08-TESTING.md`](docs/08-TESTING.md) | Full automation-testing strategy (every test type) |
| [`docs/09-WORKFLOW.md`](docs/09-WORKFLOW.md) | The build process: planner ↔ Claude Code 7-step loop |
| [`docs/10-SETUP.md`](docs/10-SETUP.md) | Local folder, git, Claude Code connection |
| [`docs/11-UI-DEVELOPMENT.md`](docs/11-UI-DEVELOPMENT.md) | Design-drop workflow + page-by-page UI specs (Shopify + portal) |
| [`docs/12-DEPLOYMENT-RAILWAY.md`](docs/12-DEPLOYMENT-RAILWAY.md) | Railway hosting: services, DBs, cron, CI/CD |
| [`docs/13-SECURITY.md`](docs/13-SECURITY.md) | Security best practices (strong, proportionate) |
| [`docs/14-ENGINEERING-PRINCIPLES.md`](docs/14-ENGINEERING-PRINCIPLES.md) | No over-engineering · best practices · stop-and-flag protocol |
| [`docs/15-UI-DESIGN-LOVABLE.md`](docs/15-UI-DESIGN-LOVABLE.md) | Designing the portal UI in Lovable: features, flows, prompts, import |
| [`CLAUDE.md`](CLAUDE.md) | Executor context (read every session) |
| [`docs/templates/`](docs/templates) | Planning prompt, implementation plan, build request, build summary + test report, PR review, **flag**, module spec, test plan, ADR, bug report |
| [`design/`](design) | Drop UI designs here for Claude Code to implement |

## How it's built

A **planner/reviewer** Claude conversation owns the roadmap and reviews diffs;
**Claude Code** executes one **Build Request** at a time on a branch off `develop`. Git
is the coordination layer; `CLAUDE.md` is the standing brief. Merging to `develop`
**auto-deploys to Railway staging** (CI-gated); `main` deploys production. See
[`docs/09-WORKFLOW.md`](docs/09-WORKFLOW.md) and [`docs/12-DEPLOYMENT-RAILWAY.md`](docs/12-DEPLOYMENT-RAILWAY.md).

## Quick start

```bash
pnpm install
cp .env.example .env
docker compose -f tooling/docker-compose.yml up -d   # PG+Timescale, Redis, MinIO, Mailpit, Ollama
pnpm db:migrate && pnpm db:seed
pnpm dev                                              # web + api + shopify-app
pnpm test                                             # unit + integration
```

## Status

Pre-development. Start at **Phase 0**, `TASK-001` in
[`docs/07-PROJECT-PLAN.md`](docs/07-PROJECT-PLAN.md).
