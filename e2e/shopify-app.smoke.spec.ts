import { expect, test } from '@playwright/test';

test('shopify app-home renders the Polaris page + CTA', async ({ page }) => {
  await page.goto('http://localhost:3002/');
  await expect(page.getByRole('heading', { name: 'Profitily' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Open Profitily Portal/i }),
  ).toBeVisible();
});
