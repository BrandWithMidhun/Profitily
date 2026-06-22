/**
 * Request-scoped tenant context (sev-1). The current `storeId` is held in an
 * AsyncLocalStorage so the Prisma tenant extension can auto-scope every query
 * without threading storeId through call sites. Propagates across awaits.
 *
 * Auth is not wired yet (TASK-010/011) — a trusted auth layer will call
 * `runWithStore` once it has verified the tenant. Until then no storeId is set,
 * so tenant-scoped queries fail closed (see ./extension.ts).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

type TenantStore = { readonly storeId: string };

const storage = new AsyncLocalStorage<TenantStore>();

/** Run `fn` with `storeId` established as the tenant context for its async scope. */
export function runWithStore<T>(storeId: string, fn: () => T): T {
  return storage.run({ storeId }, fn);
}

/** The current tenant storeId, or undefined when no tenant context is set. */
export function getStoreId(): string | undefined {
  return storage.getStore()?.storeId;
}
