import { PrismaClient } from '@prisma/client';

import { tenantExtension } from './extension.js';

/**
 * A PrismaClient with the tenant-isolation guard applied. Use this everywhere
 * tenant data is accessed; pair it with `runWithStore` to establish the storeId.
 */
export function createTenantClient(
  options?: ConstructorParameters<typeof PrismaClient>[0],
) {
  return new PrismaClient(options).$extends(tenantExtension);
}

export type TenantClient = ReturnType<typeof createTenantClient>;
