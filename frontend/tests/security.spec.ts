import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  test('should allow /api/test/reset in test mode', async ({ request }) => {
    // This test runs against the test environment (NODE_ENV=test)
    // as configured in playwright.config.ts webServer
    const response = await request.post('http://localhost:3001/api/test/reset');
    
    // Should succeed in test mode
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('message', 'Test state reset');
    expect(data).toHaveProperty('counter', 0);
    expect(data).toHaveProperty('notes');
  });
});
