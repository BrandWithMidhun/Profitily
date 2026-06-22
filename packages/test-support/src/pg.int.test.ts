import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startPostgres } from './containers.js';
import { dockerGate, requireDockerOrThrow } from './docker-gate.js';

const { Client } = pg;
const gate = await dockerGate();
if (gate.skip) {
  console.warn('[pg.int] Docker unavailable — skipping. Set REQUIRE_DOCKER=1 to force.');
}

describe.skipIf(gate.skip)('integration: Postgres + TimescaleDB (Testcontainers)', () => {
  let stop: () => Promise<unknown>;
  let url: string;

  beforeAll(async () => {
    requireDockerOrThrow(gate);
    const pgc = await startPostgres();
    url = pgc.url;
    stop = () => pgc.container.stop();
  });

  afterAll(async () => {
    await stop?.();
  });

  it('connects, SELECT 1, and timescaledb is available', async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const one = await client.query<{ ok: number }>('SELECT 1 AS ok');
      expect(one.rows[0]?.ok).toBe(1);
      const ext = await client.query(
        `SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'`,
      );
      expect(ext.rows.length).toBe(1);
    } finally {
      await client.end();
    }
  });
});
