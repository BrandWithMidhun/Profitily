import preset from '@profitily/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

// packages/core is the correctness boundary: enforce 100% coverage on ALL four
// metrics (branch is the one the real engine will live or die on). CI fails on
// breach. Other packages carry no threshold yet (ratcheted as code lands).
export default mergeConfig(
  preset,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts'],
        thresholds: {
          branches: 100,
          lines: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  }),
);
