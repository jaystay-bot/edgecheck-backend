import { test, expect } from '@playwright/test';

test('Props page loads successfully', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/EdgeCheck/i);
});
