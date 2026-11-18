import { test, expect } from '@playwright/test';

test('login page names the lab and the demo accounts', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Academic Review Lab' })).toBeVisible();
  await expect(page.getByText('ada@demo.lab')).toBeVisible();
});
