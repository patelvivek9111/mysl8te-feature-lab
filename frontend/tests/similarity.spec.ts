import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-submit').click();
}

async function openGraceSubmission(page: Page) {
  await page.getByTestId('course-HIST210').click();
  await page.getByRole('link', { name: /Open version/ }).first().click();
  await expect(page.getByTestId('similarity-score')).toContainText('%');
}

test('teacher sees matches and exclusions in the document and recalculates with new options', async ({ page }) => {
  await signIn(page, 'ada@demo.lab', 'DemoTeacher!2026');
  await openGraceSubmission(page);

  await page.getByTestId('layer-similarity').check();
  await expect(page.getByTestId('similarity-legend')).toBeVisible();
  const exact = page.locator('[data-testid="document-text"] mark.match-exact');
  await expect(exact.first()).toContainText('truth universally acknowledged');
  await expect(exact.first()).toHaveAttribute('title', /Exact match: Pride and Prejudice/);
  const bibliography = page.locator('[data-testid="document-text"] mark.excluded[title="Excluded bibliography"]');
  await expect(bibliography).toContainText('Austen, Jane');
  await expect(bibliography).toHaveAttribute('aria-label', /^Excluded bibliography\. /);
  await expect(bibliography).toHaveAttribute('tabindex', '0');
  await expect(page.getByTestId('highlight')).toBeDisabled();

  try {
    await page.getByTestId('opt-exclude-bibliography').uncheck();
    await page.getByTestId('recalculate').click();
    await expect(page.getByTestId('recalc-message')).toContainText('Similarity recalculated');
    await expect(bibliography).toHaveCount(0);
    await expect(page.getByTestId('opt-exclude-bibliography')).not.toBeChecked();

    await page.getByTestId('opt-threshold').fill('0');
    expect(await page.getByTestId('opt-threshold').evaluate((input) => (input as HTMLInputElement).checkValidity())).toBe(false);
  } finally {
    await page.getByTestId('opt-threshold').fill('8');
    await page.getByTestId('opt-exclude-bibliography').check();
    await page.getByTestId('recalculate').click();
    await expect(bibliography).toContainText('Austen, Jane');
  }

  await page.getByTestId('layer-annotations').check();
  await expect(page.locator('[data-testid="document-text"] mark.excluded')).toHaveCount(0);
  await expect(page.getByTestId('highlight')).toBeEnabled();
});

test('students can view the similarity overlay but cannot change matching options', async ({ page }) => {
  await signIn(page, 'grace@demo.lab', 'DemoStudent!2026');
  await page.getByTestId('course-HIST210').click();
  await page.getByRole('link', { name: 'View latest submission' }).first().click();
  await expect(page.getByTestId('similarity-score')).toContainText('%');
  await expect(page.getByTestId('similarity-options')).toHaveCount(0);
  await page.getByTestId('layer-similarity').check();
  await expect(page.locator('[data-testid="document-text"] mark.match-exact').first()).toContainText('truth universally acknowledged');
});
