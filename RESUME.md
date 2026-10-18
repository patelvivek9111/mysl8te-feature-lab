# Resume Instructions

**Last updated**: 2026-10-18  
**Branch**: `cursor/academic-review-lab-ba77`  
**Base to preserve**: `main` (still the counter/notes bootstrap). Do not merge this branch yourself.

## What runs

Academic Review Lab is a React/Vite frontend on port 5173 and an Express/Prisma API on port 3001. PostgreSQL 16 is local, peer auth over the socket. Demo seed runs when `SEED_ON_BOOT=true`.

```bash
bash .cursor/install.sh
bash .cursor/start.sh
```

Open `http://localhost:5173`.

- Instructor: `ada@demo.lab` / `DemoTeacher!2026`
- Students: `grace@demo.lab` and `alan@demo.lab` / `DemoStudent!2026`
- Course: HIST210, Reading Public-Domain Prose

## Verified in this session

- Backend `tsc`, `src/extract.test.ts`, and `src/product.test.ts` passed (DOCX, ZIP, TXT, Markdown, CSV, source, PNG preview, PDF upload, draft hiding, student isolation, similarity above 15% on the seeded essay, AI consequential use false).
- Playwright: 5 passed (login, auth rejection, no `/api/test/reset`, teacher publish then student read, student text upload).

## Do not claim

This is not a finished Canvas/Turnitin replacement. Release acceptance is not met. No hosted HTTPS URL exists. Do not start duplicate agents on new branches for the same product.

## Next implementation, in order

1. Versioned Prisma migrations instead of only `db push`.
2. Annotation types still missing in the UI: strikethrough, freehand, area, and format-specific anchors (cells, slides, lines, timestamps). PDF highlights are text offsets from `pdftotext`, not glyph boxes.
3. Comment replies, notification mark-read in the UI, and annotated-file export (today's export is a text transcript).
4. Honest format work: legacy DOC/XLS/PPT are stored only. Audio/video play without transcripts. HEIC has no preview. OCR is absent until `tesseract` is installed. Do not mark a format tested until a test extracts or previews it.
5. Similarity and AI reports need a larger labeled evaluation set before any consequential use. Keep consequential use off.
6. Security and performance pass beyond the current 401/403/404 checks.
