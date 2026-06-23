/**
 * @profitily/db — single source of DB truth.
 *
 * Re-exports the generated Prisma client (PrismaClient class, model types, and
 * the PlanTier / SubStatus / Role enums), plus the tenant-isolation guard
 * (extension + request-scoped storeId context) and a tenant-aware client factory.
 */
export * from '@prisma/client';

export { getStoreId, runWithStore } from './tenant/context.js';
export { TenantIsolationError, tenantExtension } from './tenant/extension.js';
export { createTenantClient } from './tenant/client.js';
export type { TenantClient } from './tenant/client.js';
export { createUnscopedClient } from './tenant/bootstrap.js';
export type { UnscopedClient } from './tenant/bootstrap.js';
