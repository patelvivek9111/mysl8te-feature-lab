import { test, expect } from '@playwright/test';

test('unauthenticated course requests are rejected', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3001/api/courses');
  expect(response.status()).toBe(401);
});

test('the old production test-reset route is gone', async ({ request }) => {
  const response = await request.post('http://127.0.0.1:3001/api/test/reset');
  expect(response.status()).toBe(404);
});
