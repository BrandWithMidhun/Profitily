import { defineConfig } from 'vitest/config';

// Integration tests (Testcontainers) — `pnpm test:int`. Long timeouts for container
// startup. Standalone config (NOT the shared preset) so its `*.test.ts` glob never
// pulls these slow, Docker-dependent suites into the fast `pnpm test` unit gate.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    passWithNoTests: true,
  },
});
