import { Injectable } from '@nestjs/common';
import { encryptSecret } from '@profitily/shared';

import { BootstrapPrismaService } from './bootstrap-prisma.service.js';
import { StoreEventsService } from './store-events.service.js';

export interface InstallInput {
  shopDomain: string;
  accessToken: string;
  baseCurrency: string;
  country?: string | undefined;
  ownerEmail?: string | undefined;
}

/**
 * Provisions a store at Shopify install (M01). Idempotent upserts on the UNGUARDED
 * bootstrap client (no tenant context exists yet). The access token is encrypted at
 * rest (AES-256-GCM) — the plaintext never touches the DB or logs.
 */
@Injectable()
export class ShopifyInstallService {
  constructor(
    private readonly bootstrap: BootstrapPrismaService,
    private readonly events: StoreEventsService,
  ) {}

  async install(input: InstallInput): Promise<{ storeId: string }> {
    const encryptedToken = encryptSecret(input.accessToken);
    const db = this.bootstrap.client;

    const store = await db.store.upsert({
      where: { shopDomain: input.shopDomain },
      create: {
        shopDomain: input.shopDomain,
        accessToken: encryptedToken,
        baseCurrency: input.baseCurrency,
        country: input.country ?? null,
      },
      update: {
        accessToken: encryptedToken,
        baseCurrency: input.baseCurrency,
        country: input.country ?? null,
        uninstalledAt: null,
      },
    });

    if (input.ownerEmail) {
      const user = await db.user.upsert({
        where: { email: input.ownerEmail },
        create: { email: input.ownerEmail },
        update: {},
      });
      await db.membership.upsert({
        where: { userId_storeId: { userId: user.id, storeId: store.id } },
        create: { userId: user.id, storeId: store.id, role: 'OWNER' },
        update: {},
      });
    }

    this.events.storeInstalled({ storeId: store.id, shopDomain: input.shopDomain });
    return { storeId: store.id };
  }
}
