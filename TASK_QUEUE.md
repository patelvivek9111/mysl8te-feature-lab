# Task Queue

**Last updated**: 2026-11-18  
**Branch**: `cursor/academic-review-lab-ba77` (canonical, ADR-010)

DONE means code plus passing automated tests on this branch.

## Done

| Task | Evidence |
| --- | --- |
| Auth, courses, assignments, roster, submissions, draft/publish grades, rubric ratings, notifications list | `src/product.test.ts`, `tests/workflows.spec.ts` |
| Text-anchored highlight, underline, point comments | `tests/workflows.spec.ts` |
| Background processing; extraction for TXT, Markdown, CSV, source, PDF, DOCX, ZIP listing, PNG preview | `src/extract.test.ts`, `src/product.test.ts` |
| UNIFY-1: canonical branch chosen; SQLite branch frozen (ADR-010) | `DECISIONS.md` |
| UNIFY-2: similarity engine ported and wired in (NEAR matches, quote/bibliography exclusions persisted, ranked sources, char-offset passages with source excerpts) | `src/similarity/similarity.test.ts` (27), product test "similarity passages..." |
| UNIFY-3: AI-writing module ported and wired in (uncertainty band, release-gate stage, safeguards, model-version rebuild) | `src/ai-writing/ai-writing.test.ts` (24) |
| UNIFY-4: AI assessment teacher-only; teacher review decision + note endpoint and UI | product test "AI-writing review...", Playwright teacher flow |
| UNIFY-5: versioned Prisma migrations replace `db push`; baseline for old databases; post-deploy drift check | `prisma/migrations`, `scripts/migrate.sh`; verified on fresh, existing, and legacy `db push` databases |
| REVIEW-INT: integration review findings fixed (peer redaction for students, review history in audit log, non-blocking stale rebuild, review race/status checks) | product tests 13-14, `ACCEPTANCE.md` |
| node_modules untracked | commit 0bb6975 |

## Ready (priority order)

1. **PORT-SEC** Port auth hardening from the frozen SQLite branch (`backend/src/auth/`, `routes/auth.ts`, `test/api.test.ts`): login rate limiting, server-side revocable sessions or short-lived JWT plus logout, password policy, and the REVIEW-1 regression tests (upload DoS limits, oversized JSON, enumeration).
2. **PORT-PDF** Port annotated PDF export (`documents/pdfExport.ts`, pdf-lib) to replace the text-transcript export; test by parsing the exported PDF.
3. **REVIEW-INT-2** Remaining low findings: refresh the AI paraphrase context after similarity recalculation (keeping review history), persist excluded-region offsets for highlighting, decide the admin review policy.
4. **ANNOT-2** Comment reply threads in the API and UI (the `Comment.parentId` column exists), notification mark-read in the UI, strikethrough/area/freehand tools.
5. **CI-1** GitHub Actions: Postgres service, backend typecheck + tests, frontend build + lint + Playwright, upload videos.
6. **PERF-1** Per-course cached similarity index (port `similarityIndex` caching approach) and benchmarks: 25 MB PDF extract, 2k-document corpus via API, 500 annotations.
7. **FMT-1** Format matrix expansion only with passing tests: ODT, XLSX/PPTX text, OCR (tesseract), Office-to-PDF (LibreOffice).
8. **E5** Turnitin-style match groups (not cited/quoted, missing quotations, missing citation) on top of quote/citation detection.
9. **G2** Institution isolation tests and admin UI.
10. **SEC-2** Security review report: authorization matrix tests, upload fuzzing, dependency audit. Independent review recorded in `ACCEPTANCE.md`.

## Blocked

| Task | Blocker |
| --- | --- |
| Validate AI-writing assessment against release gates | Needs an independent, consented labeled dataset (`BLOCKERS.md`) |
| Internet/publication source corpus for similarity | No licensed index; only reference texts and peer submissions |
| Hosted HTTPS deployment | Not authorized |

## Do not restart

Do not rebuild the schema, the research docs, or a second app. Do not commit to the frozen SQLite branch. `main` stays untouched until a reviewed merge.
