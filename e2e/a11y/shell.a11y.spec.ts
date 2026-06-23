import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Full-DOM accessibility (docs/08 §2.9, docs/11 §6) — real browser, includes contrast.
// Structural a11y also runs in the PR gate via vitest-axe (RTL).

test('portal app shell is axe-clean', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(
    page.getByRole('heading', { name: 'Executive Dashboard', exact: true }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('shopify app-home is axe-clean', async ({ page }) => {
  await page.goto('http://localhost:3002/');
  await expect(
    page.getByRole('link', { name: /Open Profitily Portal/i }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
