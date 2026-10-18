import { test, expect } from '@playwright/test';

test.describe('MySL8TE Feature Lab Bootstrap Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application and display the title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('MySL8TE Feature Lab');
    await expect(page.locator('.subtitle')).toContainText('Environment Bootstrap Test Interface');
  });

  test('should show server health status', async ({ page }) => {
    await page.waitForSelector('.health-status');
    const healthStatus = await page.locator('.health-status').textContent();
    expect(healthStatus).toContain('Server');
  });

  test('should increment counter on button click', async ({ page }) => {
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    const incrementButton = page.locator('[data-testid="increment-button"]');
    
    await expect(counterDisplay).toBeVisible();
    await expect(counterDisplay).toContainText('Current Count:');
    
    await incrementButton.click();
    await page.waitForTimeout(500);
    await expect(counterDisplay).toContainText('1');
    
    await incrementButton.click();
    await page.waitForTimeout(500);
    await expect(counterDisplay).toContainText('2');
  });

  test('should reset counter to zero', async ({ page }) => {
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    const incrementButton = page.locator('[data-testid="increment-button"]');
    const resetButton = page.locator('[data-testid="reset-button"]');
    
    await incrementButton.click();
    await page.waitForTimeout(500);
    await incrementButton.click();
    await page.waitForTimeout(500);
    
    await resetButton.click();
    await page.waitForTimeout(500);
    await expect(counterDisplay).toContainText('0');
  });

  test('should add a note through typing and button click', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    await noteInput.fill('Test note from Playwright');
    await addNoteButton.click();
    
    await page.waitForTimeout(500);
    await expect(notesList).toContainText('Test note from Playwright');
  });

  test('should add a note by pressing Enter key', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    await noteInput.fill('Note added with Enter key');
    await noteInput.press('Enter');
    
    await page.waitForTimeout(500);
    await expect(notesList).toContainText('Note added with Enter key');
  });

  test('should add multiple notes and display them in order', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    
    const notes = ['First note', 'Second note', 'Third note'];
    
    for (const note of notes) {
      await noteInput.fill(note);
      await addNoteButton.click();
      await page.waitForTimeout(300);
    }
    
    for (const note of notes) {
      await expect(page.locator('[data-testid="notes-list"]')).toContainText(note);
    }
  });

  test('should clear all notes', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const clearNotesButton = page.locator('[data-testid="clear-notes-button"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    await noteInput.fill('Note to be cleared');
    await addNoteButton.click();
    await page.waitForTimeout(500);
    
    await clearNotesButton.click();
    await page.waitForTimeout(500);
    
    await expect(notesList).toContainText('No notes yet');
  });

  test('should persist counter value on page refresh', async ({ page }) => {
    const incrementButton = page.locator('[data-testid="increment-button"]');
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    
    await incrementButton.click();
    await page.waitForTimeout(500);
    await incrementButton.click();
    await page.waitForTimeout(500);
    await incrementButton.click();
    await page.waitForTimeout(500);
    
    await expect(counterDisplay).toContainText('3');
    
    await page.reload();
    await page.waitForTimeout(1000);
    
    await expect(counterDisplay).toContainText('3');
  });

  test('should test complete workflow: counter and notes interaction', async ({ page }) => {
    const incrementButton = page.locator('[data-testid="increment-button"]');
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    await incrementButton.click();
    await page.waitForTimeout(300);
    
    await noteInput.fill('First workflow note');
    await addNoteButton.click();
    await page.waitForTimeout(300);
    
    await incrementButton.click();
    await page.waitForTimeout(300);
    
    await noteInput.fill('Second workflow note');
    await addNoteButton.click();
    await page.waitForTimeout(300);
    
    await expect(counterDisplay).toContainText('2');
    await expect(notesList).toContainText('First workflow note');
    await expect(notesList).toContainText('Second workflow note');
  });

  test('should take a screenshot of the interface', async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/interface.png', fullPage: true });
  });
});
