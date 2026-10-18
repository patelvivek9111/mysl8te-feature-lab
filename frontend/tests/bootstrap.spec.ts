import { test, expect } from '@playwright/test';

test.describe('MySL8TE Feature Lab Bootstrap Tests', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset backend state before each test
    await request.post('http://localhost:3001/api/test/reset');
    await page.goto('/');
    // Wait for initial data to load
    await expect(page.locator('[data-testid="counter-display"]')).toBeVisible();
  });

  test('should load the application and display the title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('MySL8TE Feature Lab');
    await expect(page.locator('.subtitle')).toContainText('Environment Bootstrap Test Interface');
  });

  test('should show server health status', async ({ page }) => {
    const healthStatus = page.locator('.health-status');
    await expect(healthStatus).toBeVisible();
    await expect(healthStatus).toContainText('Server');
  });

  test('should display initial counter value of zero', async ({ page }) => {
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    await expect(counterDisplay).toContainText('Current Count:');
    await expect(counterDisplay).toContainText('0');
  });

  test('should increment counter on button click', async ({ page }) => {
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    const incrementButton = page.locator('[data-testid="increment-button"]');
    
    // Verify starts at 0
    await expect(counterDisplay).toContainText('0');
    
    // First increment
    await incrementButton.click();
    await expect(counterDisplay).toContainText('1');
    
    // Second increment
    await incrementButton.click();
    await expect(counterDisplay).toContainText('2');
    
    // Third increment
    await incrementButton.click();
    await expect(counterDisplay).toContainText('3');
  });

  test('should reset counter to zero', async ({ page }) => {
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    const incrementButton = page.locator('[data-testid="increment-button"]');
    const resetButton = page.locator('[data-testid="reset-button"]');
    
    // Verify starts at 0
    await expect(counterDisplay).toContainText('0');
    
    // Increment twice
    await incrementButton.click();
    await expect(counterDisplay).toContainText('1');
    await incrementButton.click();
    await expect(counterDisplay).toContainText('2');
    
    // Reset
    await resetButton.click();
    await expect(counterDisplay).toContainText('0');
  });

  test('should add a note through typing and button click', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    // Verify empty state
    await expect(notesList).toContainText('No notes yet');
    
    // Add note
    await noteInput.fill('Test note from Playwright');
    await addNoteButton.click();
    
    // Verify note appears
    await expect(notesList).toContainText('Test note from Playwright');
    await expect(page.locator('[data-testid="note-0"]')).toHaveText('Test note from Playwright');
  });

  test('should add a note by pressing Enter key', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    // Verify empty state
    await expect(notesList).toContainText('No notes yet');
    
    // Add note with Enter key
    await noteInput.fill('Note added with Enter key');
    await noteInput.press('Enter');
    
    // Verify note appears
    await expect(notesList).toContainText('Note added with Enter key');
    await expect(page.locator('[data-testid="note-0"]')).toHaveText('Note added with Enter key');
  });

  test('should add multiple notes and display them in order', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    const notes = ['First note', 'Second note', 'Third note'];
    
    // Add notes sequentially
    for (const note of notes) {
      await noteInput.fill(note);
      await addNoteButton.click();
      await expect(notesList).toContainText(note);
    }
    
    // Verify all notes present in order
    await expect(page.locator('[data-testid="note-0"]')).toHaveText('First note');
    await expect(page.locator('[data-testid="note-1"]')).toHaveText('Second note');
    await expect(page.locator('[data-testid="note-2"]')).toHaveText('Third note');
  });

  test('should clear all notes', async ({ page }) => {
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const clearNotesButton = page.locator('[data-testid="clear-notes-button"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    // Add a note
    await noteInput.fill('Note to be cleared');
    await addNoteButton.click();
    await expect(notesList).toContainText('Note to be cleared');
    
    // Clear notes
    await clearNotesButton.click();
    await expect(notesList).toContainText('No notes yet');
    
    // Verify clear button is gone
    await expect(clearNotesButton).not.toBeVisible();
  });

  test('should persist counter value on page refresh', async ({ page }) => {
    const incrementButton = page.locator('[data-testid="increment-button"]');
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    
    // Increment counter three times
    await incrementButton.click();
    await expect(counterDisplay).toContainText('1');
    await incrementButton.click();
    await expect(counterDisplay).toContainText('2');
    await incrementButton.click();
    await expect(counterDisplay).toContainText('3');
    
    // Refresh page
    await page.reload();
    
    // Verify counter persists
    await expect(counterDisplay).toBeVisible();
    await expect(counterDisplay).toContainText('3');
  });

  test('should handle complete workflow: counter and notes interaction', async ({ page }) => {
    const incrementButton = page.locator('[data-testid="increment-button"]');
    const noteInput = page.locator('[data-testid="note-input"]');
    const addNoteButton = page.locator('[data-testid="add-note-button"]');
    const counterDisplay = page.locator('[data-testid="counter-display"]');
    const notesList = page.locator('[data-testid="notes-list"]');
    
    // Verify initial state
    await expect(counterDisplay).toContainText('0');
    await expect(notesList).toContainText('No notes yet');
    
    // Increment counter
    await incrementButton.click();
    await expect(counterDisplay).toContainText('1');
    
    // Add first note
    await noteInput.fill('First workflow note');
    await addNoteButton.click();
    await expect(notesList).toContainText('First workflow note');
    
    // Increment counter again
    await incrementButton.click();
    await expect(counterDisplay).toContainText('2');
    
    // Add second note
    await noteInput.fill('Second workflow note');
    await addNoteButton.click();
    await expect(notesList).toContainText('Second workflow note');
    
    // Verify final state
    await expect(counterDisplay).toContainText('2');
    await expect(page.locator('[data-testid="note-0"]')).toHaveText('First workflow note');
    await expect(page.locator('[data-testid="note-1"]')).toHaveText('Second workflow note');
  });
});

