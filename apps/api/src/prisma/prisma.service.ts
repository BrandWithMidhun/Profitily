import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { createTenantClient, type TenantClient } from '@profitily/db';

/**
 * Owns the tenant-aware Prisma client (guard applied). Consumers use
 * `prisma.client` and must establish a storeId context via `runWithStore`
 * before touching tenant-scoped models (the guard fails closed otherwise).
 *
 * Connection is lazy (Prisma connects on first query) so the app — and the
 * /health route — boots without requiring a database. Disconnect on shutdown.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: TenantClient = createTenantClient();

  onModuleInit(): void {
    // Intentionally no eager $connect — keep boot DB-free; Prisma connects
    // lazily on first query. Fail-fast connect can be added with deployment.
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
