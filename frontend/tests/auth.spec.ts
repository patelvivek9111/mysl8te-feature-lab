import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://127.0.0.1:3001';
const EMAIL = 'grace@demo.lab';
const PASSWORD = 'DemoStudent!2026';
const TEMPORARY = 'Lantern-Harbor-Quartz-2026';

async function signIn(page: Page, password = PASSWORD) {
  await page.goto('/login');
  await page.getByTestId('email').fill(EMAIL);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Student workspace' })).toBeVisible();
}

async function changePassword(page: Page, from: string, to: string) {
  await page.getByTestId('account-link').click();
  await page.getByTestId('current-password').fill(from);
  await page.getByTestId('new-password').fill(to);
  await page.getByTestId('confirm-password').fill(to);
  await page.getByTestId('change-password').click();
}

// The demo database is shared with the other specs, so always put the seeded password back.
// Try the seeded password first so a passing run never records a failed sign-in.
async function restorePassword(request: APIRequestContext) {
  for (const password of [PASSWORD, TEMPORARY]) {
    const login = await request.post(`${API}/api/auth/login`, { data: { email: EMAIL, password } });
    if (login.status() !== 200) continue;
    const { token } = await login.json() as { token: string };
    const headers = { Authorization: `Bearer ${token}` };
    if (password === TEMPORARY) {
      const restored = await request.post(`${API}/api/auth/password`, { headers, data: { currentPassword: TEMPORARY, newPassword: PASSWORD } });
      expect(restored.status()).toBe(200);
    }
    await request.post(`${API}/api/auth/logout`, { headers });
    return;
  }
  throw new Error(`Could not restore the demo password for ${EMAIL}; restart the API with SEED_ON_BOOT=true`);
}

test('password change follows the policy and signs out other sessions', async ({ page, browser, request }) => {
  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await signIn(other);
    await signIn(page);

    await changePassword(page, PASSWORD, 'password1234');
    await expect(page.getByRole('alert')).toContainText('This password is too common');

    await changePassword(page, PASSWORD, TEMPORARY);
    await expect(page.getByTestId('password-changed')).toContainText(/Signed out [1-9]\d* other sessions?/);

    await other.getByTestId('course-HIST210').click();
    await expect(other.getByTestId('session-expired')).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Student workspace' })).toBeVisible();
    await changePassword(page, TEMPORARY, PASSWORD);
    await expect(page.getByTestId('password-changed')).toBeVisible();
  } finally {
    await restorePassword(request);
    await otherContext.close();
  }
});

test('sign out everywhere revokes the token on the server', async ({ page }) => {
  await signIn(page);
  const token = await page.evaluate(() => sessionStorage.getItem('lab_token'));
  expect(token).toBeTruthy();
  await page.getByTestId('account-link').click();
  await page.getByTestId('sign-out-everywhere').click();
  await expect(page.getByTestId('login-submit')).toBeVisible();
  const response = await page.request.get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status()).toBe(401);
});

test('an unknown account gets the same generic error as a wrong password', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('email').fill('nobody@demo.lab');
  await page.getByTestId('password').fill('Wrong-Password-2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
});
