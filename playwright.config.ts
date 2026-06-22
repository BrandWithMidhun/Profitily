import { defineConfig, devices } from '@playwright/test';

// Playwright projects (TASK-005 smoke → TASK-007 e2e/CI → TASK-008 a11y + visual):
//  - smoke : fast render checks (cross-OS, runs locally + nightly)
//  - a11y  : @axe-core/playwright full-DOM accessibility (cross-OS, nightly)
//  - visual: toHaveScreenshot baselines — Linux-only baselines committed via the
//            Playwright Docker image (see e2e/visual/README.md); runs nightly.
// `pnpm test:e2e` runs smoke + a11y; `pnpm test:visual` runs visual (Linux/Docker).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  projects: [
    {
      name: 'smoke',
      testMatch: '*.smoke.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'a11y',
      testMatch: 'a11y/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual',
      testMatch: 'visual/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
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
