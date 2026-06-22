import { expect, test } from '@playwright/test';

test('portal home renders with the stub user', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await expect(
    page.getByRole('heading', { name: /Profitily Portal/i }),
  ).toBeVisible();
  await expect(page.getByTestId('stub-user')).toContainText('Demo User');
});
