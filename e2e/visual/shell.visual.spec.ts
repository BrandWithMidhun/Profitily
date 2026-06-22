import { expect, test } from '@playwright/test';

// Visual baselines (docs/08 §2.8). Baselines are Linux-only and committed via the
// Playwright Docker image — see e2e/visual/README.md for the regen command. Runs nightly.

test('portal shell — desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/');
  await expect(
    page.getByRole('heading', { name: 'Executive Dashboard', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('portal-shell-desktop.png', {
    fullPage: true,
  });
});

test('portal shell — mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/');
  await expect(
    page.getByRole('heading', { name: 'Executive Dashboard', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('portal-shell-mobile.png', {
    fullPage: true,
  });
});

test('shopify app-home', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('http://localhost:3002/');
  await expect(
    page.getByRole('link', { name: /Open Profitily Portal/i }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('shopify-app-home.png', {
    fullPage: true,
  });
});
