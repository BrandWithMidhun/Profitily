/**
 * Tenant-isolation Prisma client extension (sev-1, docs/13 §2).
 *
 * Every model that has a `storeId` field is "tenant-scoped". For those models
 * the extension:
 *   - throws if there is NO storeId in context (fail closed — no unscoped access);
 *   - otherwise forces the context storeId onto the query: a `storeId` filter on
 *     read/update/delete/upsert `where` (relying on Prisma's WhereUniqueInput
 *     tolerating an extra filter field, so even `findUnique({where:{id}})` is
 *     scoped — a cross-tenant id lookup returns nothing), and `data.storeId` on
 *     create/createMany/upsert.create (a create attempting another store's id is
 *     overridden, never landing in the wrong tenant).
 * Models without `storeId` (Store — the tenant root keyed by `id`; User — global)
 * pass through untouched.
 *
 * ⚠️ GUARD BOUNDARIES — the following are NOT auto-scoped (sev-1 awareness):
 *   1. `$queryRaw` / `$executeRaw` (raw SQL) BYPASS this extension entirely.
 *      Never pass tenant data through raw SQL without a manual `storeId` predicate.
 *   2. Nested writes (e.g. `store.create({ data: { memberships: { create } } })`)
 *      are not seen by this top-level `$allOperations` hook — use top-level ops on
 *      the tenant model, or scope the nested data explicitly.
 *   3. `upsert` `where` scoping relies on the unique selector tolerating an extra
 *      `storeId` filter (true for Membership/Subscription today).
 * Hardening for these (e.g. a lint rule banning `$queryRaw` on tenant models,
 * nested-write handling) is tracked as a follow-up task and should land when those
 * patterns actually appear. See docs/16 + docs/13 §2.
 */
import { Prisma } from '@prisma/client';

import { getStoreId } from './context.js';

export class TenantIsolationError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Tenant isolation: refused "${operation}" on tenant-scoped model "${model}" ` +
        `with no storeId in context. Wrap the call in runWithStore(storeId, ...).`,
    );
    this.name = 'TenantIsolationError';
  }
}

/**
 * Models with a `storeId` field, derived once from the runtime data model. New
 * tenant tables are covered automatically; only the isolation TEST SUITE must be
 * extended per new tenant table (docs/08 §3).
 */
const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'storeId'))
    .map((model) => model.name),
);

function scopeArgs(
  operation: string,
  args: Record<string, unknown>,
  storeId: string,
  model: string,
): Record<string, unknown> {
  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'update':
    case 'updateMany':
    case 'delete':
    case 'deleteMany': {
      const where = (args.where as Record<string, unknown> | undefined) ?? {};
      return { ...args, where: { ...where, storeId } };
    }
    case 'create': {
      const data = (args.data as Record<string, unknown> | undefined) ?? {};
      return { ...args, data: { ...data, storeId } };
    }
    case 'createMany':
    case 'createManyAndReturn': {
      const data = args.data;
      const scoped = Array.isArray(data)
        ? (data as Record<string, unknown>[]).map((row) => ({ ...row, storeId }))
        : { ...((data as Record<string, unknown> | undefined) ?? {}), storeId };
      return { ...args, data: scoped };
    }
    case 'upsert': {
      const where = (args.where as Record<string, unknown> | undefined) ?? {};
      const create = (args.create as Record<string, unknown> | undefined) ?? {};
      return {
        ...args,
        where: { ...where, storeId },
        create: { ...create, storeId },
      };
    }
    default:
      // Unknown/unsupported operation on a tenant model — fail closed.
      throw new TenantIsolationError(model, operation);
  }
}

export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        $allOperations(params) {
          const { model, operation, args, query } = params;
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }
          const storeId = getStoreId();
          if (storeId === undefined) {
            throw new TenantIsolationError(model, operation);
          }
          const scoped = scopeArgs(
            operation,
            args as Record<string, unknown>,
            storeId,
            model,
          );
          return query(scoped as typeof args);
        },
      },
    },
  }),
);
