# Task Queue - Prioritized Executable Backlog

**Last Updated**: 2026-10-18 19:15 UTC (automation run on `cursor/mysl8te-full-application-b175`)

Status values: DONE (code + tests in repo) · IN PROGRESS · READY · BLOCKED. "DONE" requires passing automated tests.

## Done (verified by tests)
| ID | Task | Evidence |
|----|------|----------|
| B1' | Persistence: SQLite schema + migrations (ADR-008) | `backend/src/db/database.ts`, API tests run on `:memory:` |
| B2 | Upload API with size limits, attempts | `test/api.test.ts` (413/415/422 cases) |
| B3 | Magic-byte format detection (PDF, DOCX, TXT, MD, HTML, CSV, RTF, PNG, JPEG, WEBP, GIF) | `test/processing.test.ts` |
| B5 | Text extraction: PDF (pdfjs), DOCX (mammoth), RTF, HTML (sanitized), text | `test/processing.test.ts` |
| AUTH | Register/login/logout, scrypt, hashed sessions, CSRF header, rate limit | `test/api.test.ts` authentication suite |
| C1 | Annotation model + API (6 types, page-relative coords, replies, draft/publish) | `test/api.test.ts` workflow test |
| D1-D3 | Courses, enrollment, assignments, rubrics, submissions, grading, publish | `test/api.test.ts` |
| C-EXP | Feedback export: HTML + annotated PDF (markers burned on PDF pages) | `test/api.test.ts` parses exported PDF |
| E-SVC | Similarity service + routes (course-scoped corpus, exclusions, role-filtered excerpts) | `test/api.test.ts` similarity test |
| F-SVC | AI-assessment routes: teacher-only, review decision + note required | `test/api.test.ts` AI test |

## In progress (this run's subagents; see AGENT_STATUS.md)
| ID | Task | Owner |
|----|------|-------|
| E3 | Similarity engine (k-gram index, extension, NEAR matches, exclusions, perf test) | subagent "Similarity detection engine" |
| F1-F2 | AI-writing signals + uncertainty + evaluation harness + release gates doc | subagent "AI-writing assessment module" |
| C3/D4/G1 | Frontend: auth, dashboards, SpeedGrader, DocViewer tools, similarity + AI tabs, student view; Playwright E2E with video | subagent "Frontend app and Playwright E2E" |

## Ready (next, in priority order)
1. **REVIEW-1** Independent code/security review of backend + frontend (separate reviewer agent; fix findings, add regression tests).
2. **CI-1** GitHub Actions workflow: backend typecheck + vitest, frontend build + lint + Playwright (upload videos as artifacts).
3. **H-PERF** Benchmarks: upload/extract latency for 1/10/25 MB PDFs, similarity with 2k-doc corpus via API, annotation list with 500 annotations.
4. **B7** OCR for images/scanned PDFs (tesseract.js; needs npm + language data download) - currently images are view/annotate only.
5. **B4** Office conversion to PDF for faithful DOCX/PPTX/XLSX rendering (LibreOffice not installed; evaluate `apt-get install libreoffice-core` in install.sh).
6. **B-FMT** Additional formats: ODT, XLSX/CSV table view, PPTX text, code files with syntax view.
7. **D5** Comment bank, grading history/audit view, notifications.
8. **E5** Turnitin-style match groups (Not cited/quoted, Missing quotations, Missing citation, Cited and quoted) built on quote/citation detection.
9. **G2** Multi-tenant institution isolation + admin role UI.
10. **H-SEC** Security review report (authz matrix tests, upload fuzzing, dependency audit).

## Blocked
| ID | Task | Blocker |
|----|------|---------|
| F3 | Validate AI-writing assessment against release gates | BLOCKER-002: needs independent labeled dataset (see BLOCKERS.md) |
| E-EXT | Internet/publication source corpus | BLOCKER-003: no licensed web/publication index; only course reference sources + student papers |
