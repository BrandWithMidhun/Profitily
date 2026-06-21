# tooling — local infrastructure

Local, all-OSS service plane for Profitily AI. Zero paid accounts; everything runs
in Docker Compose (`docker-compose.yml`). Image tags are pinned (no `:latest`) for
supply-chain safety (`docs/13 §11`).

## Quick start

```bash
cp .env.example .env        # fill real values later; defaults are local-only
pnpm infra:up               # start core services, wait until healthy
pnpm smoke                  # verify connectivity (PG, Redis, MinIO, Mailpit)
pnpm infra:down             # stop everything
```

## Services

| Service | Image | Default host port(s) | Purpose |
|---|---|---|---|
| postgres | `timescale/timescaledb:2.17.2-pg16` | 5432 | Postgres + TimescaleDB (truth + time-series) |
| valkey | `valkey/valkey:8.0.2-alpine` | 6379 | Cache + BullMQ backend (OSS Redis fork) |
| minio | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | 9000 (API), 9001 (console) | S3-compatible object storage |
| minio-init | `minio/mc:RELEASE.2025-04-16T18-13-26Z` | — | One-shot: creates the `profitily-reports` bucket, then exits |
| mailpit | `axllent/mailpit:v1.21.8` | 1025 (SMTP), 8025 (web UI) | Local email capture |
| ollama | `ollama/ollama:0.6.8` | 11434 | Local AI — **opt-in** (profile `ai`) |

Credentials in the compose file (`profitily/profitily`, `minioadmin/minioadmin`) are
**local-only dev defaults** and match `.env.example`. Never reuse them elsewhere; real
secrets live in `.env` (git-ignored) and the per-environment secret store.

## Commands

| Command | What it does |
|---|---|
| `pnpm infra:up` | Start the four core services (postgres, valkey, minio, mailpit) and wait for healthy |
| `pnpm infra:up:ai` | Same as above **plus** Ollama (`--profile ai`) |
| `pnpm infra:down` | Stop and remove the containers (named volumes persist) |
| `pnpm smoke` | Connect to PG/Redis/MinIO/Mailpit and report health (the MinIO check also asserts the `profitily-reports` bucket exists); exits non-zero on failure |

### Ollama (AI) is opt-in

Ollama is gated behind the `ai` compose profile, so `pnpm infra:up` does **not** start
it. You only need it from the AI phase onward (TASK-070+). Start it with:

```bash
pnpm infra:up:ai
# then pull a model once (not auto-pulled; the server is healthy without one):
docker compose -f tooling/docker-compose.yml exec ollama ollama pull llama3.1
```

## Running alongside another local stack (port clashes)

The most common clash is **port 5432** (a local Postgres) — and **6379** (a local
Redis). All host-side ports are overridable via `*_HOST_PORT` env vars (canonical
defaults baked in); container-internal ports never change. To run Profitily next to
another stack, set the host ports **and** the matching connection URLs in your `.env`:

```bash
# .env — run side by side with another Postgres/Redis on 5432/6379
DB_HOST_PORT=5433
REDIS_HOST_PORT=6380
DATABASE_URL=postgresql://profitily:profitily@localhost:5433/profitily
REDIS_URL=redis://localhost:6380
```

Available overrides (defaults): `DB_HOST_PORT` (5432), `REDIS_HOST_PORT` (6379),
`MINIO_API_HOST_PORT` (9000), `MINIO_CONSOLE_HOST_PORT` (9001),
`MAILPIT_SMTP_HOST_PORT` (1025), `MAILPIT_UI_HOST_PORT` (8025),
`OLLAMA_HOST_PORT` (11434).

## Notes

- `pnpm infra:up` uses `--wait`, so it returns only once healthchecks pass (or fails).
- TimescaleDB: the image preinstalls the extension; `pnpm smoke` confirms it is
  **available** (non-destructive). Hypertables/continuous aggregates come in TASK-003.
- Volumes (`pgdata`, `valkeydata`, `miniodata`, `ollamadata`) persist across restarts;
  remove them with `docker compose -f tooling/docker-compose.yml down -v`.
