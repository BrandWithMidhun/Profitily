import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startValkey } from './containers.js';
import { dockerGate, requireDockerOrThrow } from './docker-gate.js';

const gate = await dockerGate();
if (gate.skip) {
  console.warn('[redis.int] Docker unavailable — skipping. Set REQUIRE_DOCKER=1 to force.');
}

describe.skipIf(gate.skip)('integration: Valkey (Testcontainers)', () => {
  let stop: () => Promise<unknown>;
  let url: string;

  beforeAll(async () => {
    requireDockerOrThrow(gate);
    const valkey = await startValkey();
    url = valkey.url;
    stop = () => valkey.container.stop();
  });

  afterAll(async () => {
    await stop?.();
  });

  it('responds to PING', async () => {
    const client = new Redis(url);
    try {
      expect(await client.ping()).toBe('PONG');
    } finally {
      client.disconnect();
    }
  });
});
