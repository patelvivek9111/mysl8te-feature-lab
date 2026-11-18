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
| PORT-PDF: annotated feedback PDF replaces the text transcript (text marks over character ranges, original PDF pages with rotation-aware page marks, 200-page cap, drafts hidden from students, audited); annotation input validation; independent review findings fixed | `src/services/pdfExport.test.ts` (13), product tests 26-27, `tests/workflows.spec.ts` download check |
| REVIEW-INT-2: excluded-region offsets (migration + boot backfill), document overlay of exact/near matches and exclusions, teacher matching-options form with strict validation and audit, AI paraphrase refresh on recalculation with review history, row-locked AI rebuilds and advisory-locked report rebuilds, admin policy (ADR-011); independent review findings fixed | product tests 22-23 and 26, `tests/similarity.spec.ts` (2) |
| PORT-SEC: revocable hashed sessions, logout/logout-all, password change + policy, login and password-change rate limiting, enumeration-safe login, security headers, JSON/upload size errors, Account UI; independent review findings fixed | `src/auth.test.ts` (11), `src/services/authPolicy.test.ts` (10), `tests/auth.spec.ts` (3) |

## Ready (priority order)

1. **ANNOT-2** Comment reply threads in the API and UI (the `Comment.parentId` column exists), notification mark-read in the UI, strikethrough/area/freehand tools.
2. **CI-1** GitHub Actions: Postgres service, `poppler-utils` (renderer tests require `pdftotext`/`pdftoppm`), backend typecheck + tests, frontend build + lint + Playwright, upload videos.
3. **PERF-1** Per-course cached similarity index (port `similarityIndex` caching approach), move PDF export rendering off the request thread (worker or cache), cap FREE_DRAW stroke data, make the similarity overlay sweep O(n log n) (currently boundaries x spans), and benchmarks: 25 MB PDF extract, 2k-document corpus via API, 500 annotations.
4. **FMT-1** Format matrix expansion only with passing tests: ODT, XLSX/PPTX text, OCR (tesseract), Office-to-PDF (LibreOffice).
5. **E5** Turnitin-style match groups (not cited/quoted, missing quotations, missing citation) on top of quote/citation detection.
6. **G2** Institution isolation tests and admin UI.
7. **SEC-2** Security review report: authorization matrix tests, upload fuzzing, dependency audit. Independent review recorded in `ACCEPTANCE.md`.
8. **SEC-3** Auth follow-ups from the PORT-SEC review: distributed per-account brute-force protection without enabling lockout DoS (progressive delay), shared rate-limit store for multi-instance deploys, optional MFA, admin-driven password reset.
9. **REVIEW-INT-3** Low findings from the REVIEW-INT-2 review: hold one per-submission lock across the report rebuild and AI refresh so two overlapping recalculations cannot leave them out of step; retry the first AI assessment insert on a unique-key race; keyboard navigation between similarity marks (roving tabindex or next-match button); version exclusion rules with `ALGORITHM_VERSION`.

## Blocked

| Task | Blocker |
| --- | --- |
| Validate AI-writing assessment against release gates | Needs an independent, consented labeled dataset (`BLOCKERS.md`) |
| Internet/publication source corpus for similarity | No licensed index; only reference texts and peer submissions |
| Hosted HTTPS deployment | Not authorized |

## Do not restart

Do not rebuild the schema, the research docs, or a second app. Do not commit to the frozen SQLite branch. `main` stays untouched until a reviewed merge.
