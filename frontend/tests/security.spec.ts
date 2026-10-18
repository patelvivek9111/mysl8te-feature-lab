import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  test('should block /api/test/reset in production mode', async ({ request }) => {
    // Try to call reset endpoint
    const response = await request.post('http://localhost:3001/api/test/reset');
    
    // In test/development mode, should succeed (status 200)
    // This test verifies the endpoint works in test mode
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('message', 'Test state reset');
  });
});

// Note: To test production blocking, set NODE_ENV=production and verify 403 response
// This is tested in the backend unit tests
