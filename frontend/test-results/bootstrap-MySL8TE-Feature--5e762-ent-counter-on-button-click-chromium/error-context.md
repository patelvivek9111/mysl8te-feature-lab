# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bootstrap.spec.ts >> MySL8TE Feature Lab Bootstrap Tests >> should increment counter on button click
- Location: tests/bootstrap.spec.ts:19:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-testid="counter-display"]')
Expected substring: "1"
Received string:    "Current Count: 2"
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('[data-testid="counter-display"]') with timeout 5000ms
  - waiting for locator('[data-testid="counter-display"]')
    14 × locator resolved to <div class="counter-display" data-testid="counter-display">…</div>
       - unexpected value "Current Count: 2"

```

```yaml
- text: "Current Count:"
- strong: "2"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('MySL8TE Feature Lab Bootstrap Tests', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/');
  6   |   });
  7   | 
  8   |   test('should load the application and display the title', async ({ page }) => {
  9   |     await expect(page.locator('h1')).toContainText('MySL8TE Feature Lab');
  10  |     await expect(page.locator('.subtitle')).toContainText('Environment Bootstrap Test Interface');
  11  |   });
  12  | 
  13  |   test('should show server health status', async ({ page }) => {
  14  |     await page.waitForSelector('.health-status');
  15  |     const healthStatus = await page.locator('.health-status').textContent();
  16  |     expect(healthStatus).toContain('Server');
  17  |   });
  18  | 
  19  |   test('should increment counter on button click', async ({ page }) => {
  20  |     const counterDisplay = page.locator('[data-testid="counter-display"]');
  21  |     const incrementButton = page.locator('[data-testid="increment-button"]');
  22  |     
  23  |     await expect(counterDisplay).toBeVisible();
  24  |     await expect(counterDisplay).toContainText('Current Count:');
  25  |     
  26  |     await incrementButton.click();
  27  |     await page.waitForTimeout(500);
> 28  |     await expect(counterDisplay).toContainText('1');
      |                                  ^ Error: expect(locator).toContainText(expected) failed
  29  |     
  30  |     await incrementButton.click();
  31  |     await page.waitForTimeout(500);
  32  |     await expect(counterDisplay).toContainText('2');
  33  |   });
  34  | 
  35  |   test('should reset counter to zero', async ({ page }) => {
  36  |     const counterDisplay = page.locator('[data-testid="counter-display"]');
  37  |     const incrementButton = page.locator('[data-testid="increment-button"]');
  38  |     const resetButton = page.locator('[data-testid="reset-button"]');
  39  |     
  40  |     await incrementButton.click();
  41  |     await page.waitForTimeout(500);
  42  |     await incrementButton.click();
  43  |     await page.waitForTimeout(500);
  44  |     
  45  |     await resetButton.click();
  46  |     await page.waitForTimeout(500);
  47  |     await expect(counterDisplay).toContainText('0');
  48  |   });
  49  | 
  50  |   test('should add a note through typing and button click', async ({ page }) => {
  51  |     const noteInput = page.locator('[data-testid="note-input"]');
  52  |     const addNoteButton = page.locator('[data-testid="add-note-button"]');
  53  |     const notesList = page.locator('[data-testid="notes-list"]');
  54  |     
  55  |     await noteInput.fill('Test note from Playwright');
  56  |     await addNoteButton.click();
  57  |     
  58  |     await page.waitForTimeout(500);
  59  |     await expect(notesList).toContainText('Test note from Playwright');
  60  |   });
  61  | 
  62  |   test('should add a note by pressing Enter key', async ({ page }) => {
  63  |     const noteInput = page.locator('[data-testid="note-input"]');
  64  |     const notesList = page.locator('[data-testid="notes-list"]');
  65  |     
  66  |     await noteInput.fill('Note added with Enter key');
  67  |     await noteInput.press('Enter');
  68  |     
  69  |     await page.waitForTimeout(500);
  70  |     await expect(notesList).toContainText('Note added with Enter key');
  71  |   });
  72  | 
  73  |   test('should add multiple notes and display them in order', async ({ page }) => {
  74  |     const noteInput = page.locator('[data-testid="note-input"]');
  75  |     const addNoteButton = page.locator('[data-testid="add-note-button"]');
  76  |     
  77  |     const notes = ['First note', 'Second note', 'Third note'];
  78  |     
  79  |     for (const note of notes) {
  80  |       await noteInput.fill(note);
  81  |       await addNoteButton.click();
  82  |       await page.waitForTimeout(300);
  83  |     }
  84  |     
  85  |     for (const note of notes) {
  86  |       await expect(page.locator('[data-testid="notes-list"]')).toContainText(note);
  87  |     }
  88  |   });
  89  | 
  90  |   test('should clear all notes', async ({ page }) => {
  91  |     const noteInput = page.locator('[data-testid="note-input"]');
  92  |     const addNoteButton = page.locator('[data-testid="add-note-button"]');
  93  |     const clearNotesButton = page.locator('[data-testid="clear-notes-button"]');
  94  |     const notesList = page.locator('[data-testid="notes-list"]');
  95  |     
  96  |     await noteInput.fill('Note to be cleared');
  97  |     await addNoteButton.click();
  98  |     await page.waitForTimeout(500);
  99  |     
  100 |     await clearNotesButton.click();
  101 |     await page.waitForTimeout(500);
  102 |     
  103 |     await expect(notesList).toContainText('No notes yet');
  104 |   });
  105 | 
  106 |   test('should persist counter value on page refresh', async ({ page }) => {
  107 |     const incrementButton = page.locator('[data-testid="increment-button"]');
  108 |     const counterDisplay = page.locator('[data-testid="counter-display"]');
  109 |     
  110 |     await incrementButton.click();
  111 |     await page.waitForTimeout(500);
  112 |     await incrementButton.click();
  113 |     await page.waitForTimeout(500);
  114 |     await incrementButton.click();
  115 |     await page.waitForTimeout(500);
  116 |     
  117 |     await expect(counterDisplay).toContainText('3');
  118 |     
  119 |     await page.reload();
  120 |     await page.waitForTimeout(1000);
  121 |     
  122 |     await expect(counterDisplay).toContainText('3');
  123 |   });
  124 | 
  125 |   test('should test complete workflow: counter and notes interaction', async ({ page }) => {
  126 |     const incrementButton = page.locator('[data-testid="increment-button"]');
  127 |     const noteInput = page.locator('[data-testid="note-input"]');
  128 |     const addNoteButton = page.locator('[data-testid="add-note-button"]');
```