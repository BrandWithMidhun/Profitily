import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createUnscopedClient, type UnscopedClient } from '@profitily/db';

/**
 * Owns the UNGUARDED Prisma client used ONLY for new-tenant provisioning at Shopify
 * install (no tenant context exists yet; the guarded client would correctly reject the
 * contextless writes). This is the single sanctioned `createUnscopedClient()` call site
 * in production code (docs/13 §2, TASK-009/010). Everything else uses PrismaService
 * (guarded). Tests override this provider with a client pointed at a throwaway DB.
 */
@Injectable()
export class BootstrapPrismaService implements OnModuleDestroy {
  // eslint-disable-next-line no-restricted-syntax -- UNSCOPED-BOOTSTRAP-OK: new-tenant provisioning at Shopify install, before any tenant context exists
  readonly client: UnscopedClient = createUnscopedClient();

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
