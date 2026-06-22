# syntax=docker/dockerfile:1
#
# Production image for apps/api. Build context = repo ROOT (monorepo).
#   docker build -f apps/api/Dockerfile -t profitily-api .
#
# Debian (glibc) base — NOT alpine/musl — so the @swc/core native binary works.
# Single-stage for now: pnpm + node_modules + prisma stay in the final image so
# BOTH the pre-deploy `migrate:deploy` and `node apps/api/dist/main.js` run.
# (Multi-stage slimming is a follow-up.)
FROM node:24-bookworm-slim

# OpenSSL is required by the Prisma query engine (slim image omits libssl) — needed
# at runtime for the pre-deploy `migrate:deploy` and all DB queries, and at build
# time so `prisma generate` detects the correct engine (debian-openssl-3.0.x).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Pin pnpm to match package.json "packageManager". Installed via npm — NOT the
# Nixpacks corepack@0.24.1, which can't run pnpm@11 on Node 24
# (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING).
RUN npm install -g pnpm@11.1.2

WORKDIR /app

# Copy the workspace. .dockerignore excludes node_modules / dist / .env / .git /
# .turbo, so no local secrets or stale build artifacts enter the image.
COPY . .

# Install ALL deps (dev included: @swc/cli, typescript, prisma are build-time).
# No DATABASE_URL or secrets are needed at build time — `pnpm build` runs
# `prisma generate` (offline) + SWC/tsc for the libs and the api.
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Runtime: main.ts binds 0.0.0.0 on process.env.PORT. Railway injects PORT and
# all runtime secrets (JWT_SECRET / ENCRYPTION_KEY / S3_* / …) — none referenced
# at build time, so there are no SecretsUsedInArgOrEnv warnings.
CMD ["node", "apps/api/dist/main.js"]
