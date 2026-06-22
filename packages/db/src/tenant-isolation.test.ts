/**
 * Standing tenant-isolation suite (sev-1, docs/08 §3). Proves the guard:
 *   (a) read scoping — store A never sees store B's rows (incl. cross-tenant findUnique);
 *   (b) fail-closed — no context → tenant findMany/findUnique/create throw;
 *   (c) write scoping — updateMany/deleteMany/create/createMany/upsert under A never
 *       affect or create into store B (tested with users shared across A & B);
 *   (d) Store (tenant root) and User (global) are NOT force-scoped.
 *
 * EXTEND THIS SUITE for every new tenant table. Reachability-gated like the
 * migration tests: SKIPPED (not passed) when no DB; CI must force-run (TASK-006).
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTenantClient, runWithStore, TenantIsolationError } from './index.js';
import { probeDb, requireDbOrThrow } from './test-support/db-gate.js';

const { Client } = pg;

const baseUrl = process.env.DATABASE_URL;
const schemaPath = fileURLToPath(
  new URL('../prisma/schema.prisma', import.meta.url),
);

function withDatabase(connectionString: string, dbName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

// Probe up front (never throws). In CI/REQUIRE_DB the sev-1 suite still runs and
// fails loudly via requireDbOrThrow in beforeAll; locally it skips cleanly.
const gate = await probeDb();
if (gate.skip) {
  console.warn(
    '[tenant-isolation.test] DATABASE_URL unreachable or unset — skipping. Run `pnpm infra:up` (CI sets REQUIRE_DB and fails instead).',
  );
}

describe.skipIf(gate.skip)('tenant isolation (sev-1)', () => {
  // Assigned in beforeAll (not at collection time) so an unset DATABASE_URL
  // skips cleanly instead of throwing in `new URL(undefined)`.
  let adminUrl: string;
  let dbName: string;
  let testUrl: string;

  let raw: PrismaClient;
  let guarded: ReturnType<typeof createTenantClient>;
  let storeA: string;
  let storeB: string;
  let membershipA1: string;
  let membershipB1: string;
  let emailCounter = 0;

  const newUser = async (): Promise<string> => {
    const user = await raw.user.create({
      data: { email: `iso-${dbName}-${emailCounter++}@test.local` },
    });
    return user.id;
  };

  // Run a guarded operation within store A's context. The `await` happens INSIDE
  // runWithStore so the (lazy) Prisma query — and the guard's getStoreId() — runs
  // while the AsyncLocalStorage scope is active. This mirrors the real request
  // flow, where auth wraps the whole handler in runWithStore.
  const asA = <T>(fn: () => Promise<T>): Promise<T> =>
    runWithStore(storeA, async () => await fn());

  beforeAll(async () => {
    requireDbOrThrow(gate);
    dbName = `profitily_isotest_${randomBytes(6).toString('hex')}`;
    adminUrl = withDatabase(baseUrl!, 'postgres');
    testUrl = withDatabase(baseUrl!, dbName);

    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await admin.end();
    }
    execSync(`prisma migrate deploy --schema="${schemaPath}"`, {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });

    raw = new PrismaClient({ datasourceUrl: testUrl });
    guarded = createTenantClient({ datasourceUrl: testUrl });

    const a = await raw.store.create({
      data: { shopDomain: 'a.myshopify.com', accessToken: 'placeholder' },
    });
    const b = await raw.store.create({
      data: { shopDomain: 'b.myshopify.com', accessToken: 'placeholder' },
    });
    storeA = a.id;
    storeB = b.id;

    const uA = await newUser();
    const uB = await newUser();
    membershipA1 = (
      await raw.membership.create({
        data: { userId: uA, storeId: storeA, role: 'OWNER' },
      })
    ).id;
    membershipB1 = (
      await raw.membership.create({
        data: { userId: uB, storeId: storeB, role: 'OWNER' },
      })
    ).id;
    await raw.subscription.create({ data: { storeId: storeA } });
    await raw.subscription.create({ data: { storeId: storeB } });
  });

  afterAll(async () => {
    await raw?.$disconnect();
    await guarded?.$disconnect();
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

  describe('(a) read scoping', () => {
    it('store A sees only its own memberships, never B', async () => {
      const rows = await asA(() => guarded.membership.findMany());
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.every((r) => r.storeId === storeA)).toBe(true);
      expect(rows.some((r) => r.id === membershipB1)).toBe(false);
    });

    it('store A sees only its own subscription', async () => {
      const rows = await asA(() =>
        guarded.subscription.findMany(),
      );
      expect(rows.every((r) => r.storeId === storeA)).toBe(true);
    });

    it('cross-tenant findUnique(B.id) under A returns null', async () => {
      const row = await asA(() =>
        guarded.membership.findUnique({ where: { id: membershipB1 } }),
      );
      expect(row).toBeNull();
    });

    it('same-tenant findUnique(A.id) under A returns the row', async () => {
      const row = await asA(() =>
        guarded.membership.findUnique({ where: { id: membershipA1 } }),
      );
      expect(row?.id).toBe(membershipA1);
    });

    it('count under A counts only A', async () => {
      const scoped = await asA(() => guarded.membership.count());
      const actualA = await raw.membership.count({ where: { storeId: storeA } });
      expect(scoped).toBe(actualA);
    });
  });

  describe('(b) fail closed (no storeId context)', () => {
    it('membership.findMany throws', async () => {
      await expect(guarded.membership.findMany()).rejects.toBeInstanceOf(
        TenantIsolationError,
      );
    });

    it('membership.findUnique throws', async () => {
      await expect(
        guarded.membership.findUnique({ where: { id: membershipA1 } }),
      ).rejects.toBeInstanceOf(TenantIsolationError);
    });

    it('membership.create throws', async () => {
      const uid = await newUser();
      await expect(
        guarded.membership.create({
          data: { userId: uid, storeId: storeA, role: 'OWNER' },
        }),
      ).rejects.toBeInstanceOf(TenantIsolationError);
    });

    it('subscription.findMany throws', async () => {
      await expect(guarded.subscription.findMany()).rejects.toBeInstanceOf(
        TenantIsolationError,
      );
    });
  });

  describe('(c) write scoping under store A never affects/creates into B', () => {
    it('updateMany only mutates A rows (same user in A & B)', async () => {
      const shared = await newUser();
      await raw.membership.create({
        data: { userId: shared, storeId: storeA, role: 'VIEWER' },
      });
      await raw.membership.create({
        data: { userId: shared, storeId: storeB, role: 'VIEWER' },
      });

      await asA(() =>
        guarded.membership.updateMany({
          where: { userId: shared },
          data: { role: 'ADMIN' },
        }),
      );

      const inA = await raw.membership.findFirst({
        where: { userId: shared, storeId: storeA },
      });
      const inB = await raw.membership.findFirst({
        where: { userId: shared, storeId: storeB },
      });
      expect(inA?.role).toBe('ADMIN');
      expect(inB?.role).toBe('VIEWER'); // B untouched
    });

    it('deleteMany only deletes A rows (same user in A & B)', async () => {
      const shared = await newUser();
      await raw.membership.create({
        data: { userId: shared, storeId: storeA, role: 'VIEWER' },
      });
      await raw.membership.create({
        data: { userId: shared, storeId: storeB, role: 'VIEWER' },
      });

      await asA(() =>
        guarded.membership.deleteMany({ where: { userId: shared } }),
      );

      expect(
        await raw.membership.findFirst({
          where: { userId: shared, storeId: storeA },
        }),
      ).toBeNull();
      expect(
        await raw.membership.findFirst({
          where: { userId: shared, storeId: storeB },
        }),
      ).not.toBeNull(); // B row survives
    });

    it('create forces storeId = A even when B is requested', async () => {
      const uid = await newUser();
      await asA(() =>
        guarded.membership.create({
          data: { userId: uid, storeId: storeB, role: 'OWNER' },
        }),
      );
      const created = await raw.membership.findFirst({ where: { userId: uid } });
      expect(created?.storeId).toBe(storeA);
      expect(
        await raw.membership.count({ where: { userId: uid, storeId: storeB } }),
      ).toBe(0);
    });

    it('createMany forces storeId = A on every row', async () => {
      const u1 = await newUser();
      const u2 = await newUser();
      await asA(() =>
        guarded.membership.createMany({
          data: [
            { userId: u1, storeId: storeB, role: 'VIEWER' },
            { userId: u2, storeId: storeB, role: 'VIEWER' },
          ],
        }),
      );
      const created = await raw.membership.findMany({
        where: { userId: { in: [u1, u2] } },
      });
      expect(created.length).toBe(2);
      expect(created.every((r) => r.storeId === storeA)).toBe(true);
    });

    it('upsert stays within A (create path forced to A, then update path)', async () => {
      const uid = await newUser();
      // Create path: requested storeB is overridden to A.
      await asA(() =>
        guarded.membership.upsert({
          where: { userId_storeId: { userId: uid, storeId: storeA } },
          create: { userId: uid, storeId: storeB, role: 'OWNER' },
          update: {},
        }),
      );
      const afterCreate = await raw.membership.findFirst({ where: { userId: uid } });
      expect(afterCreate?.storeId).toBe(storeA);
      expect(
        await raw.membership.count({ where: { userId: uid, storeId: storeB } }),
      ).toBe(0);

      // Update path: existing A row is updated, still A.
      await asA(() =>
        guarded.membership.upsert({
          where: { userId_storeId: { userId: uid, storeId: storeA } },
          create: { userId: uid, storeId: storeA, role: 'OWNER' },
          update: { role: 'ADMIN' },
        }),
      );
      const afterUpdate = await raw.membership.findFirst({ where: { userId: uid } });
      expect(afterUpdate?.role).toBe('ADMIN');
      expect(afterUpdate?.storeId).toBe(storeA);
    });
  });

  describe('(d) non-tenant models are not force-scoped', () => {
    it('User.findMany does not throw without context', async () => {
      await expect(guarded.user.findMany()).resolves.toBeInstanceOf(Array);
    });

    it('Store.findMany / findUnique do not throw without context', async () => {
      await expect(guarded.store.findMany()).resolves.toBeInstanceOf(Array);
      const store = await guarded.store.findUnique({ where: { id: storeA } });
      expect(store?.id).toBe(storeA);
    });
  });
});
