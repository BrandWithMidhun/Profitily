/**
 * Tenant-isolation Prisma client extension (sev-1, docs/13 §2).
 *
 * Every model that has a `storeId` field is "tenant-scoped". For those models the
 * extension:
 *   - throws if there is NO storeId in context (fail closed — no unscoped access);
 *   - otherwise forces the context storeId onto the query: a `storeId` filter on
 *     read/update/delete/upsert `where` (relying on Prisma's WhereUniqueInput
 *     tolerating an extra filter field, so even `findUnique({where:{id}})` is scoped —
 *     a cross-tenant id lookup returns nothing), and `data.storeId` on
 *     create/createMany/upsert.create (a create attempting another store's id is
 *     overridden, never landing in the wrong tenant).
 * Models without `storeId` (Store — the tenant root keyed by `id`; User — global) pass
 * through the top-level scoping untouched, but their write payloads are STILL screened
 * for nested tenant writes (below).
 *
 * GUARD BOUNDARIES — closed by TASK-009:
 *   1. Raw SQL (`$queryRaw`/`$queryRawUnsafe`/`$executeRaw`/`$executeRawUnsafe`) cannot
 *      be tenant-scoped by a model hook, so on the guarded client it is REFUSED at
 *      runtime (throws), AND banned repo-wide by ESLint (no-restricted-syntax). A
 *      sanctioned raw query uses the UNGUARDED client with a manual `storeId` predicate
 *      and an audited `// TENANT-RAW-OK:` disable (docs/13 §7). The guarded client never
 *      runs raw — it does not "scope" raw, it rejects it.
 *   2. Nested writes (e.g. `user.update({ data: { memberships: { create } } })`) are not
 *      separate top-level operations, so they are not auto-scoped. The guard does NOT
 *      deep-scope them; it REJECTS any nested write whose target is a tenant model (fail
 *      closed). Use a top-level scoped op on the tenant model instead. New-tenant
 *      provisioning (a store + its first rows) is a trusted bootstrap on the UNGUARDED
 *      client (owned by TASK-010/011). Nested writes into non-tenant targets (e.g.
 *      connecting a global User) are allowed.
 *   3. `upsert` `where` scoping relies on the unique selector tolerating an extra
 *      `storeId` filter (true for Membership/Subscription today; proven by the suite).
 *
 * Limit (sev-1 awareness): the guard cannot verify that a nested `connect` targets an
 * in-context row (that needs a DB read) — which is exactly why nested tenant writes are
 * rejected rather than scoped. The standing isolation suite (docs/08 §3) pins both
 * directions; extend it for every new tenant table.
 */
import { Prisma } from '@prisma/client';

import { getStoreId } from './context.js';

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantIsolationError';
  }
}

function unscopedError(model: string, operation: string): TenantIsolationError {
  return new TenantIsolationError(
    `Tenant isolation: refused "${operation}" on tenant-scoped model "${model}" ` +
      `with no storeId in context. Wrap the call in runWithStore(storeId, ...).`,
  );
}

function rawSqlError(operation: string): TenantIsolationError {
  return new TenantIsolationError(
    `Tenant isolation: refused raw SQL "${operation}" on the guarded client — raw ` +
      `bypasses tenant scoping. Use scoped model operations, or the UNGUARDED client ` +
      `with a manual storeId predicate and an audited // TENANT-RAW-OK disable.`,
  );
}

function nestedWriteError(
  parentModel: string,
  relation: string,
  targetModel: string,
): TenantIsolationError {
  return new TenantIsolationError(
    `Tenant isolation: refused nested write into tenant model "${targetModel}" via ` +
      `"${parentModel}.${relation}". Nested tenant writes are not scoped — use a ` +
      `top-level scoped operation on "${targetModel}" instead.`,
  );
}

/**
 * Models with a `storeId` field, derived once from the runtime data model. New tenant
 * tables are covered automatically; only the isolation TEST SUITE must be extended per
 * new tenant table (docs/08 §3).
 */
const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'storeId'))
    .map((model) => model.name),
);

/**
 * `model -> (relationField -> targetModel)`, derived from the DMMF (same source as
 * TENANT_MODELS). Used to detect nested writes that target a tenant model.
 */
const RELATION_TARGETS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    new Map(
      model.fields
        .filter((field) => field.kind === 'object')
        .map((field) => [field.name, field.type]),
    ),
  ]),
);

const NESTED_WRITE_VERBS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'connectOrCreate',
  'connect',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'set',
  'disconnect',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively screen a write payload for `model`. Throws if any relation field nests a
 * write verb (create/connect/update/…) whose target is a TENANT model. For non-tenant
 * targets it recurses into the nested create/update data so deeper tenant nesting is
 * still caught. Reads (no data) and scalar fields are ignored.
 */
function assertNoTenantNestedWrites(model: string, payload: unknown): void {
  if (Array.isArray(payload)) {
    for (const item of payload) assertNoTenantNestedWrites(model, item);
    return;
  }
  if (!isRecord(payload)) return;
  const relations = RELATION_TARGETS.get(model);
  if (!relations) return;

  for (const [key, value] of Object.entries(payload)) {
    const target = relations.get(key);
    if (target === undefined || !isRecord(value)) continue; // scalar / not a relation write

    const verbs = Object.keys(value).filter((k) => NESTED_WRITE_VERBS.has(k));
    if (verbs.length === 0) continue;

    if (TENANT_MODELS.has(target)) {
      throw nestedWriteError(model, key, target);
    }

    // Non-tenant target: recurse into nested create/update data to catch deeper tenant
    // nesting. connect/disconnect/delete/set carry only `where`/booleans — nothing to
    // recurse, except connectOrCreate/upsert which embed create/update data.
    for (const verb of verbs) {
      const sub = value[verb];
      if (verb === 'create' || verb === 'connect' || verb === 'disconnect') {
        if (verb === 'create') assertNoTenantNestedWrites(target, sub);
      } else if (verb === 'createMany') {
        assertNoTenantNestedWrites(target, (sub as { data?: unknown })?.data);
      } else if (verb === 'connectOrCreate') {
        const items = Array.isArray(sub) ? sub : [sub];
        for (const item of items) {
          assertNoTenantNestedWrites(target, (item as { create?: unknown })?.create);
        }
      } else if (verb === 'update' || verb === 'updateMany') {
        const items = Array.isArray(sub) ? sub : [sub];
        for (const item of items) {
          // `update` may be {where,data} or, for a to-one relation, the data directly.
          const data = isRecord(item) && 'data' in item ? item.data : item;
          assertNoTenantNestedWrites(target, data);
        }
      } else if (verb === 'upsert') {
        const items = Array.isArray(sub) ? sub : [sub];
        for (const item of items) {
          assertNoTenantNestedWrites(target, (item as { create?: unknown })?.create);
          assertNoTenantNestedWrites(target, (item as { update?: unknown })?.update);
        }
      }
    }
  }
}

/** Screen every write payload an operation carries (`data`/`create`/`update`). */
function screenNestedWrites(model: string, args: Record<string, unknown>): void {
  assertNoTenantNestedWrites(model, args.data);
  assertNoTenantNestedWrites(model, args.create);
  assertNoTenantNestedWrites(model, args.update);
}

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
      throw unscopedError(model, operation);
  }
}

/** Raw SQL on the guarded client bypasses scoping → refuse (fail closed). */
function refuseRaw(operation: string): never {
  throw rawSqlError(operation);
}

export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        $allOperations(params) {
          const { model, operation, args, query } = params;
          const typedArgs = args as Record<string, unknown>;

          // (1) Nested-write screen — applies to ALL models (a non-tenant parent like
          //     User/Store can still nest a write into a tenant model).
          screenNestedWrites(model, typedArgs);

          // (2) Top-level tenant scoping — only for tenant models.
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }
          const storeId = getStoreId();
          if (storeId === undefined) {
            throw unscopedError(model, operation);
          }
          const scoped = scopeArgs(operation, typedArgs, storeId, model);
          return query(scoped as typeof args);
        },
      },
      // (3) Raw SQL hooks — the guarded client refuses raw entirely.
      $queryRaw: () => refuseRaw('$queryRaw'),
      $queryRawUnsafe: () => refuseRaw('$queryRawUnsafe'),
      $executeRaw: () => refuseRaw('$executeRaw'),
      $executeRawUnsafe: () => refuseRaw('$executeRawUnsafe'),
    },
  }),
);
