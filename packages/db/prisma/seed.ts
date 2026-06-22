/**
 * Demo seed (TASK-003): one store + owner user + membership + subscription.
 * Idempotent — re-running upserts by unique keys, never duplicating.
 *
 * Security: accessToken is a clearly-labelled DEV PLACEHOLDER, not a real token.
 * Real Shopify tokens are stored encrypted (TASK-010); no real secrets/PII here.
 */
import { PlanTier, PrismaClient, Role, SubStatus } from '@prisma/client';
import { loadEnv } from '@profitily/shared';

const DEMO_SHOP_DOMAIN = 'demo-store.myshopify.com';
const DEMO_OWNER_EMAIL = 'owner@demo-store.test';
const PLACEHOLDER_ACCESS_TOKEN = 'dev-placeholder-not-a-real-token';

async function main(): Promise<void> {
  // Validate env via the shared loader (fail-closed, secret-safe).
  loadEnv();

  const prisma = new PrismaClient();
  try {
    const store = await prisma.store.upsert({
      where: { shopDomain: DEMO_SHOP_DOMAIN },
      update: {},
      create: {
        shopDomain: DEMO_SHOP_DOMAIN,
        accessToken: PLACEHOLDER_ACCESS_TOKEN,
        baseCurrency: 'USD',
        country: 'US',
        plan: PlanTier.FREE,
      },
    });

    const user = await prisma.user.upsert({
      where: { email: DEMO_OWNER_EMAIL },
      update: {},
      create: {
        email: DEMO_OWNER_EMAIL,
        name: 'Demo Owner',
        authProvider: 'shopify',
      },
    });

    await prisma.membership.upsert({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
      update: {},
      create: { userId: user.id, storeId: store.id, role: Role.OWNER },
    });

    await prisma.subscription.upsert({
      where: { storeId: store.id },
      update: {},
      create: {
        storeId: store.id,
        tier: PlanTier.FREE,
        status: SubStatus.TRIALING,
      },
    });

    console.log(
      `Seed complete: store ${store.shopDomain}, owner ${user.email}, membership (OWNER), subscription (FREE/TRIALING).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
