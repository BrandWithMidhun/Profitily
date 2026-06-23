import { expect, test } from '@playwright/test';

test('portal renders inside the app shell', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(
    page.getByRole('heading', { name: 'Executive Dashboard', exact: true }),
  ).toBeVisible();
  // Left nav present (the shell frame)
  await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('portal nav routes are navigable', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('link', { name: 'Costs' }).click();
  await expect(
    page.getByRole('heading', { name: 'Costs', exact: true }),
  ).toBeVisible();
});
