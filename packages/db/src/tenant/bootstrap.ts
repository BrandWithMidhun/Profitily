import { PrismaClient } from '@prisma/client';

/**
 * ⚠️ UNSCOPED — returns a PrismaClient WITHOUT the tenant guard. There is NO storeId
 * scoping and NO fail-closed protection: it can read and write across every tenant.
 *
 * It exists for exactly ONE sanctioned case: **new-tenant provisioning during Shopify
 * install** (TASK-010), where the store row + its first membership are created BEFORE
 * any tenant context exists, and where the guarded client would (correctly) reject the
 * nested/contextless writes. Everything after provisioning MUST use the guarded
 * `createTenantClient()` (docs/13 §2, TASK-009).
 *
 * Every call site is lint-gated: an unjustified `createUnscopedClient(...)` fails ESLint
 * (`no-restricted-syntax`). The only sanctioned caller carries:
 *   // eslint-disable-next-line no-restricted-syntax -- UNSCOPED-BOOTSTRAP-OK: <reason>
 */
export function createUnscopedClient(
  options?: ConstructorParameters<typeof PrismaClient>[0],
): PrismaClient {
  return new PrismaClient(options);
}

export type UnscopedClient = ReturnType<typeof createUnscopedClient>;
