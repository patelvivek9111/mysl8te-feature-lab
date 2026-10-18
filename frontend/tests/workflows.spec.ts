import { test, expect } from '@playwright/test';

test('teacher publishes feedback and the student can read it', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email').fill('ada@demo.lab');
  await page.getByTestId('password').fill('DemoTeacher!2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Instructor workspace' })).toBeVisible();
  await page.getByTestId('course-HIST210').click();
  await expect(page.getByRole('heading', { name: 'Reading Public-Domain Prose' })).toBeVisible();
  await page.getByRole('link', { name: /Open version/ }).first().click();
  await expect(page.getByTestId('similarity-score')).toContainText('%');
  await expect(page.getByTestId('ai-report')).toContainText('Consequential use is disabled');
  await expect(page.getByTestId('ai-report')).toContainText('Not proof of AI authorship');
  await page.getByTestId('document-text').evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node?.textContent) throw new Error('document text missing');
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, Math.min(42, node.textContent.length));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByTestId('highlight').click();
  await expect(page.locator('mark.highlight').first()).toBeVisible();
  await page.getByTestId('rubric-Textual evidence').selectOption({ label: 'Specific · 10' });
  await page.getByTestId('rubric-Interpretation').selectOption({ label: 'Developing · 6' });
  await expect(page.getByTestId('score')).toHaveValue('16');
  await page.getByTestId('feedback').fill('The quotation is specific. Say who is certain.');
  await page.getByTestId('publish').click();
  await expect(page.getByText('Published.')).toBeVisible();
  await page.getByTestId('notifications').click();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByTestId('email').fill('grace@demo.lab');
  await page.getByTestId('password').fill('DemoStudent!2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Student workspace' })).toBeVisible();
  await page.getByTestId('course-HIST210').click();
  await page.getByRole('link', { name: 'View latest submission' }).first().click();
  await expect(page.getByTestId('published-grade')).toContainText('16');
  await expect(page.getByTestId('published-grade')).toContainText('The quotation is specific');
  await expect(page.getByText('Draft is hidden from the student.')).toHaveCount(0);
  await expect(page.getByTestId('document-text')).toContainText('truth universally acknowledged');
});

test('student uploads a text file and sees processing complete', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email').fill('alan@demo.lab');
  await page.getByTestId('password').fill('DemoStudent!2026');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('course-HIST210').click();
  const card = page.getByTestId('assignment-Optional source notes');
  await card.locator('input[type="file"]').setInputFiles({
    name: 'alan-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('These notes are my own. They describe a library visit and do not copy the assigned reading.'),
  });
  await card.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByTestId('processing-status')).toContainText('COMPLETED', { timeout: 15000 });
  await expect(page.getByTestId('document-text')).toContainText('library visit');
  await expect(page.getByTestId('ai-report')).toContainText('Not proof of AI authorship');
});
