# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bootstrap.spec.ts >> MySL8TE Feature Lab Bootstrap Tests >> should test complete workflow: counter and notes interaction
- Location: tests/bootstrap.spec.ts:125:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-testid="counter-display"]')
Expected substring: "2"
Received string:    "Current Count: 4"
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('[data-testid="counter-display"]') with timeout 5000ms
  - waiting for locator('[data-testid="counter-display"]')
    14 × locator resolved to <div class="counter-display" data-testid="counter-display">…</div>
       - unexpected value "Current Count: 4"

```

```yaml
- text: "Current Count:"
- strong: "4"
```

# Test source

```ts
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
  129 |     const counterDisplay = page.locator('[data-testid="counter-display"]');
  130 |     const notesList = page.locator('[data-testid="notes-list"]');
  131 |     
  132 |     await incrementButton.click();
  133 |     await page.waitForTimeout(300);
  134 |     
  135 |     await noteInput.fill('First workflow note');
  136 |     await addNoteButton.click();
  137 |     await page.waitForTimeout(300);
  138 |     
  139 |     await incrementButton.click();
  140 |     await page.waitForTimeout(300);
  141 |     
  142 |     await noteInput.fill('Second workflow note');
  143 |     await addNoteButton.click();
  144 |     await page.waitForTimeout(300);
  145 |     
> 146 |     await expect(counterDisplay).toContainText('2');
      |                                  ^ Error: expect(locator).toContainText(expected) failed
  147 |     await expect(notesList).toContainText('First workflow note');
  148 |     await expect(notesList).toContainText('Second workflow note');
  149 |   });
  150 | 
  151 |   test('should take a screenshot of the interface', async ({ page }) => {
  152 |     await page.waitForTimeout(1000);
  153 |     await page.screenshot({ path: 'tests/screenshots/interface.png', fullPage: true });
  154 |   });
  155 | });
  156 | 
```