/**
 * Install → persist integration (real-PG, db-gated). Proves the token is stored
 * AES-256-GCM encrypted (bind-down 1) and that re-install is idempotent (counts
 * unchanged, token re-encrypted, uninstalledAt cleared). Stubbed Shopify (the service
 * takes the already-fetched token/currency). SKIPPED locally without DB; force-run in CI.
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@profitily/db';
import { probeDb, requireDbOrThrow } from '@profitily/db/test-support';
import { decryptSecret } from '@profitily/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { BootstrapPrismaService } from './bootstrap-prisma.service.js';
import { ShopifyInstallService } from './shopify-install.service.js';
import type { StoreEventsService } from './store-events.service.js';

const { Client } = pg;
const baseUrl = process.env.DATABASE_URL;

function withDatabase(connectionString: string, dbName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

const gate = await probeDb();
if (gate.skip) {
  console.warn(
    '[shopify-install.db.test] DATABASE_URL unreachable or unset — skipping. Run `pnpm infra:up` (CI sets REQUIRE_DB).',
  );
}

describe.skipIf(gate.skip)('Shopify install → persist (encrypted at rest)', () => {
  let adminUrl: string;
  let dbName: string;
  let testUrl: string;
  let prisma: PrismaClient;
  let events: { storeInstalled: ReturnType<typeof vi.fn> };
  let service: ShopifyInstallService;
  let prevKey: string | undefined;

  beforeAll(async () => {
    requireDbOrThrow(gate);
    prevKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'integration-test-master-secret-at-least-32-chars';

    dbName = `profitily_installtest_${randomBytes(6).toString('hex')}`;
    adminUrl = withDatabase(baseUrl!, 'postgres');
    testUrl = withDatabase(baseUrl!, dbName);

    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await admin.end();
    }
    execSync('pnpm --filter @profitily/db migrate:deploy', {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ datasourceUrl: testUrl });
    events = { storeInstalled: vi.fn() };
    service = new ShopifyInstallService(
      { client: prisma } as unknown as BootstrapPrismaService,
      events as unknown as StoreEventsService,
    );
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;

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
  }, 60_000);

  it('persists the token ENCRYPTED at rest (never plaintext) + provisions owner', async () => {
    const shop = 'install-a.myshopify.com';
    const token = 'shpat_super_secret_access_token_AAA';

    const { storeId } = await service.install({
      shopDomain: shop,
      accessToken: token,
      baseCurrency: 'EUR',
      country: 'DE',
      ownerEmail: 'owner-a@shop.test',
    });

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    expect(store).not.toBeNull();
    // BIND-DOWN 1 — encrypted at rest: the column is not, and does not contain, the plaintext.
    expect(store!.accessToken).not.toBe(token);
    expect(store!.accessToken).not.toContain(token);
    expect(store!.accessToken.startsWith('v1:')).toBe(true);
    expect(decryptSecret(store!.accessToken)).toBe(token);
    // baseCurrency from Shopify (ADR 0001), not hardcoded.
    expect(store!.baseCurrency).toBe('EUR');
    expect(store!.country).toBe('DE');

    const memberships = await prisma.membership.findMany({ where: { storeId } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe('OWNER');
    const owner = await prisma.user.findUnique({
      where: { email: 'owner-a@shop.test' },
    });
    expect(owner).not.toBeNull();
    expect(events.storeInstalled).toHaveBeenCalledTimes(1);
  });

  it('re-install is idempotent: counts unchanged, token re-encrypted, uninstalledAt cleared', async () => {
    const shop = 'install-b.myshopify.com';
    await service.install({
      shopDomain: shop,
      accessToken: 'shpat_first_token_BBB',
      baseCurrency: 'USD',
      ownerEmail: 'owner-b@shop.test',
    });
    // Simulate a prior uninstall, then re-install.
    await prisma.store.update({
      where: { shopDomain: shop },
      data: { uninstalledAt: new Date() },
    });

    const before = {
      stores: await prisma.store.count(),
      users: await prisma.user.count(),
      memberships: await prisma.membership.count(),
    };

    const newToken = 'shpat_rotated_token_BBB';
    await service.install({
      shopDomain: shop,
      accessToken: newToken,
      baseCurrency: 'USD',
      ownerEmail: 'owner-b@shop.test',
    });

    expect(await prisma.store.count()).toBe(before.stores);
    expect(await prisma.user.count()).toBe(before.users);
    expect(await prisma.membership.count()).toBe(before.memberships);

    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    expect(decryptSecret(store!.accessToken)).toBe(newToken);
    expect(store!.uninstalledAt).toBeNull();
  });
});
