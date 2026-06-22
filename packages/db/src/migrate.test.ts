/**
 * Migration tests (docs/08 §2.13): apply-from-clean + apply-on-existing.
 *
 * These need a reachable Postgres+TimescaleDB (start it with `pnpm infra:up`).
 * When no DB is reachable they report as SKIPPED (never as passed) so the default
 * `pnpm test` gate stays green without Docker. CI (TASK-006) must force-run these
 * and FAIL if Postgres is unreachable.
 *
 * Each run uses a throwaway database `profitily_migtest_<rand>` on the local
 * server and drops it in afterAll (even on failure) so nothing leaks.
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

const baseUrl = process.env.DATABASE_URL;
const schemaPath = fileURLToPath(
  new URL('../prisma/schema.prisma', import.meta.url),
);

/** Replace the database name in a Postgres connection URL. */
function withDatabase(connectionString: string, dbName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function isReachable(connectionString: string): Promise<boolean> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

function migrateDeploy(databaseUrl: string): void {
  execSync(`prisma migrate deploy --schema="${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

async function migrationCount(databaseUrl: string): Promise<number> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM "_prisma_migrations"`,
    );
    return Number(rows[0]?.count ?? 0);
  } finally {
    await client.end();
  }
}

// Decide up front whether we can run for real (top-level await, ESM).
const reachable = baseUrl ? await isReachable(baseUrl) : false;
if (!reachable) {
  console.warn(
    '[migrate.test] DATABASE_URL unreachable or unset — skipping migration tests. Run `pnpm infra:up` to execute them for real.',
  );
}

describe.skipIf(!reachable)('database migrations', () => {
  const adminUrl = withDatabase(baseUrl!, 'postgres');
  const dbName = `profitily_migtest_${randomBytes(6).toString('hex')}`;
  const testUrl = withDatabase(baseUrl!, dbName);

  beforeAll(async () => {
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await admin.end();
    }
  });

  afterAll(async () => {
    // Robust cleanup even if a test threw: terminate stray connections, then drop.
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    try {
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } finally {
      await admin.end();
    }
  });

  it('applies from a clean DB: tables + timescaledb extension + data round-trip', async () => {
    migrateDeploy(testUrl);

    const client = new Client({ connectionString: testUrl });
    await client.connect();
    try {
      const migrations = await client.query<{ finished_at: Date | null }>(
        `SELECT finished_at FROM "_prisma_migrations"`,
      );
      expect(migrations.rows.length).toBeGreaterThanOrEqual(1);
      expect(migrations.rows.every((r) => r.finished_at !== null)).toBe(true);

      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const names = tables.rows.map((r) => r.table_name);
      expect(names).toEqual(
        expect.arrayContaining(['Store', 'User', 'Membership', 'Subscription']),
      );

      const ext = await client.query(
        `SELECT extname FROM pg_extension WHERE extname = 'timescaledb'`,
      );
      expect(ext.rows.length).toBe(1);
    } finally {
      await client.end();
    }

    // Data round-trip + cascade behavior through the generated client.
    const prisma = new PrismaClient({ datasourceUrl: testUrl });
    try {
      const store = await prisma.store.create({
        data: { shopDomain: 'rt.myshopify.com', accessToken: 'placeholder' },
      });
      const user = await prisma.user.create({
        data: { email: 'rt@demo.test' },
      });
      await prisma.membership.create({
        data: { userId: user.id, storeId: store.id, role: 'OWNER' },
      });
      await prisma.subscription.create({ data: { storeId: store.id } });

      const readBack = await prisma.store.findUnique({
        where: { id: store.id },
        include: { memberships: true, subscription: true },
      });
      expect(readBack?.memberships.length).toBe(1);
      expect(readBack?.subscription?.status).toBe('TRIALING');

      // Cascade: deleting the store removes its membership + subscription.
      await prisma.store.delete({ where: { id: store.id } });
      expect(await prisma.membership.count({ where: { storeId: store.id } })).toBe(0);
      expect(await prisma.subscription.count({ where: { storeId: store.id } })).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('is idempotent on an existing DB: re-running deploy is a no-op and preserves data', async () => {
    const prisma = new PrismaClient({ datasourceUrl: testUrl });
    let markerId: string;
    try {
      const marker = await prisma.store.create({
        data: { shopDomain: 'idem.myshopify.com', accessToken: 'placeholder' },
      });
      markerId = marker.id;
    } finally {
      await prisma.$disconnect();
    }

    const before = await migrationCount(testUrl);
    migrateDeploy(testUrl); // re-apply on the already-migrated DB
    const after = await migrationCount(testUrl);
    expect(after).toBe(before);

    const prisma2 = new PrismaClient({ datasourceUrl: testUrl });
    try {
      expect(
        await prisma2.store.findUnique({ where: { id: markerId } }),
      ).not.toBeNull();
    } finally {
      await prisma2.$disconnect();
    }
  });
});
