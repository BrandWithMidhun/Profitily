/**
 * Shared gate for DB-dependent test suites (TASK-006).
 *
 * Policy:
 *   - Locally with no reachable DATABASE_URL → the suite is SKIPPED (clean, visible),
 *     so `pnpm test` stays green without Docker.
 *   - In CI (`CI=true`, set automatically by GitHub Actions) or with `REQUIRE_DB=1`,
 *     an unreachable DB must NOT silently skip — the suite FAILS loudly.
 *
 * The reachability probe (`probeDb`) never throws, so it is safe to call at module
 * top level for `describe.skipIf`. The fail-loud check (`requireDbOrThrow`) is called
 * inside `beforeAll` — a hook, not collection time — to avoid the collection-time
 * crash class (e.g. `new URL(undefined)`).
 */
import pg from 'pg';

const { Client } = pg;

export type DbGate = {
  /** DATABASE_URL is set and a connection succeeded. */
  reachable: boolean;
  /** Skip the suite (only true locally when the DB is down and not required). */
  skip: boolean;
  /** The probed DATABASE_URL, if any. */
  baseUrl: string | undefined;
};

/** A reachable DB is mandatory here (GitHub sets CI=true; REQUIRE_DB=1 forces it). */
function dbRequired(): boolean {
  return process.env.CI === 'true' || process.env.REQUIRE_DB === '1';
}

async function isReachable(connectionString: string): Promise<boolean> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/**
 * Probe DATABASE_URL once. Never throws. `skip` is true only when the DB is
 * unreachable AND not required — so in CI/REQUIRE_DB the suite always runs and
 * `requireDbOrThrow` decides pass/fail.
 */
export async function probeDb(): Promise<DbGate> {
  const baseUrl = process.env.DATABASE_URL;
  const reachable = baseUrl ? await isReachable(baseUrl) : false;
  return { reachable, skip: !reachable && !dbRequired(), baseUrl };
}

/**
 * Call as the FIRST line of `beforeAll`. When a DB is required but unreachable,
 * throws a clear error so the suite fails loudly instead of skipping.
 */
export function requireDbOrThrow(gate: DbGate): void {
  if (!gate.reachable) {
    throw new Error(
      '[db-gate] DATABASE_URL is unset or unreachable, but a database is REQUIRED ' +
        'here (CI=true or REQUIRE_DB=1). The DB-gated suite must run — failing ' +
        'loudly instead of skipping.',
    );
  }
}
