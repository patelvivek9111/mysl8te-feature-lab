import { test, expect, type Page } from '@playwright/test';

const ONE_PAGE_PDF = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 20 100 Td (Hello from the lab) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
trailer<< /Root 1 0 R >>
%%EOF`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: /workspace/ })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByTestId('login-submit')).toBeVisible();
}

/** Selects 20 characters inside the longest unmarked span of the document text. */
async function selectPlainText(page: Page) {
  await page.getByTestId('document-text').evaluate((root) => {
    const spans = [...root.querySelectorAll(':scope > span')] as HTMLElement[];
    const span = spans.sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0];
    const node = span?.firstChild;
    if (!node?.textContent || node.textContent.length < 40) throw new Error('no unmarked text to select');
    const offset = node.textContent.search(/\w{3}/);
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + 20);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
}

test('teacher and student discuss feedback in a reply thread, with notifications', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  const marker = `Strike ${Date.now()}`;
  await signIn(page, 'ada@demo.lab', 'DemoTeacher!2026');
  await page.getByTestId('course-HIST210').click();
  await page.getByRole('link', { name: /Open version/ }).first().click();
  await expect(page.getByTestId('similarity-score')).toContainText('%');
  const submissionUrl = page.url();

  await selectPlainText(page);
  await page.getByTestId('annotation-comment').fill(marker);
  await page.getByTestId('strikeout').click();
  await expect(page.locator('[data-testid="document-text"] mark.strikeout').filter({ hasNotText: /^$/ }).first()).toBeVisible();
  const thread = page.getByTestId('thread').filter({ hasText: marker });
  await expect(thread).toContainText('Strikethrough');
  await expect(thread).toContainText('Draft');

  await thread.getByTestId('open-reply').first().click();
  await thread.getByTestId('reply-text').fill('Cut this phrase; the sentence is stronger without it.');
  await thread.getByTestId('send-reply').click();
  await expect(thread.getByTestId('reply')).toContainText('Cut this phrase');
  await page.getByTestId('publish').click();
  await expect(page.getByText('Published.')).toBeVisible();
  await signOut(page);

  try {
    await signIn(page, 'grace@demo.lab', 'DemoStudent!2026');
    await page.goto(submissionUrl);
    const studentThread = page.getByTestId('thread').filter({ hasText: marker });
    await expect(studentThread.getByTestId('reply')).toContainText('Cut this phrase');
    await expect(studentThread).not.toContainText('Draft');
    await expect(studentThread.getByTestId('delete-annotation')).toHaveCount(0);
    await studentThread.getByTestId('reply').getByTestId('open-reply').click();
    await studentThread.getByTestId('reply-text').fill('I kept it to show the narrator mocking the families.');
    await studentThread.getByTestId('send-reply').click();
    const nested = studentThread.locator('.replies .replies [data-testid="reply"]');
    await expect(nested).toContainText('Grace Hopper (student)');
    await expect(nested).toContainText('mocking the families');
    await signOut(page);

    await signIn(page, 'ada@demo.lab', 'DemoTeacher!2026');
    await expect(page.getByTestId('notifications')).not.toHaveText('0 unread');
    await page.getByTestId('notifications').click();
    await expect(page.getByTestId('notification').filter({ hasText: 'Grace Hopper replied to feedback' }).first()).toBeVisible();
    await page.getByTestId('mark-all-read').click();
    await expect(page.getByTestId('notifications')).toHaveText('0 unread');
    await page.reload();
    await expect(page.getByTestId('notifications')).toHaveText('0 unread');

    await page.goto(submissionUrl);
    const teacherThread = page.getByTestId('thread').filter({ hasText: marker });
    await expect(teacherThread.locator('.replies .replies [data-testid="reply"]')).toContainText('mocking the families');
  } finally {
    await page.goto(submissionUrl);
    if (await page.getByTestId('login-submit').isVisible().catch(() => false)) await signIn(page, 'ada@demo.lab', 'DemoTeacher!2026');
    await page.goto(submissionUrl);
    const cleanup = page.getByTestId('thread').filter({ hasText: marker });
    if (await cleanup.count()) {
      await cleanup.getByTestId('delete-annotation').click();
      await expect(cleanup).toHaveCount(0);
    }
  }
});

test('teacher draws an area box and a freehand mark on a PDF page', async ({ page }) => {
  await signIn(page, 'alan@demo.lab', 'DemoStudent!2026');
  await page.getByTestId('course-HIST210').click();
  const card = page.getByTestId('assignment-Optional source notes');
  await card.locator('input[type="file"]').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(ONE_PAGE_PDF) });
  await card.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByTestId('processing-status')).toContainText('COMPLETED', { timeout: 15000 });
  await expect(page.getByRole('img', { name: 'Page 1 of the submission' })).toBeVisible();
  await expect(page.getByTestId('tool-area')).toHaveCount(0);
  const submissionUrl = page.url();
  await signOut(page);

  await signIn(page, 'ada@demo.lab', 'DemoTeacher!2026');
  await page.goto(submissionUrl);
  await expect(page.getByRole('img', { name: 'Page 1 of the submission' })).toBeVisible();
  const overlay = page.getByTestId('page-overlay');
  const box = (await overlay.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);

  await page.getByTestId('annotation-comment').fill('This heading needs a source.');
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45, { steps: 5 });
  await page.mouse.up();
  await page.getByTestId('save-markup').click();
  await expect(page.getByTestId('saved-area')).toHaveCount(1);

  await page.getByTestId('tool-freehand').check();
  await page.getByTestId('annotation-comment').fill('Circle the claim.');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  await page.mouse.down();
  for (const [x, y] of [[0.3, 0.8], [0.45, 0.75], [0.5, 0.6], [0.35, 0.55], [0.2, 0.7]]) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 4 });
  }
  await page.mouse.up();
  await expect(page.getByTestId('save-markup')).toHaveText('Save drawing');
  await page.getByTestId('save-markup').click();
  await expect(page.getByTestId('saved-drawing')).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId('saved-area')).toHaveCount(1);
  await expect(page.getByTestId('saved-drawing')).toHaveCount(1);
  await expect(page.getByTestId('saved-drawing').locator('polyline')).toHaveCount(1);
  const area = page.getByTestId('saved-area');
  expect(Number(await area.getAttribute('x'))).toBeCloseTo(5, 0);
  expect(Number(await area.getAttribute('width'))).toBeCloseTo(55, 0);
  await expect(page.getByTestId('thread').filter({ hasText: 'This heading needs a source.' })).toContainText('Area on page 1');
  await expect(page.getByTestId('thread').filter({ hasText: 'Circle the claim.' })).toContainText('Drawing on page 1');
});
