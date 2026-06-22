import { fileURLToPath } from 'node:url';

import { MatchersV3, PactV4 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';

// Pact wiring proof — one trivial consumer interaction against the in-process mock
// server (no Docker). Real provider contracts (Shopify/Shiprocket/Meta/… and
// web↔api) arrive with their integration tasks (TASK-020+).
const pact = new PactV4({
  consumer: 'profitily-harness-consumer',
  provider: 'profitily-harness-provider',
  dir: fileURLToPath(new URL('../../pacts', import.meta.url)),
});

describe('contract: harness consumer ↔ provider', () => {
  it('records a trivial /ping interaction and writes a pact file', async () => {
    await pact
      .addInteraction()
      .given('the provider is up')
      .uponReceiving('a ping')
      .withRequest('GET', '/ping')
      .willRespondWith(200, (builder) => {
        builder.jsonBody({ status: MatchersV3.string('ok') });
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/ping`);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { status: string };
        expect(body.status).toBe('ok');
      });
  });
});
