import { defineConfig } from '@playwright/test';

// Minimal smoke config (TASK-005). TASK-007 extends this into the full harness
// (projects, RTL, axe, visual, CI browser install). Starts both frontend apps and
// reuses an already-running dev server locally.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  webServer: [
    {
      command: 'pnpm --filter @profitily/web dev',
      url: 'http://localhost:3000',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @profitily/shopify-app dev',
      url: 'http://localhost:3002',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
