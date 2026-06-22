import { defineConfig } from 'vitest/config';

// Contract tests (Pact consumer) — `pnpm test:contract`. In-process mock server, no
// Docker, so this runs in the fast PR gate.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/contract/**/*.pact.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    passWithNoTests: true,
  },
});
