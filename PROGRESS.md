# Progress Tracker

**Last Updated**: 2026-10-18 19:15 UTC  
Progress is counted only for code that exists in the repo with passing automated tests.

## Milestone Status
| Milestone | Status | Verified scope |
|-----------|--------|----------------|
| A - Research & Architecture | DONE | Research docs in `docs/research/`, ADRs in `DECISIONS.md` |
| B - Document Engine | PARTIAL | Upload, detection, extraction for 11 formats. Missing: OCR, Office-to-PDF conversion, spreadsheets/slides |
| C - DocViewer & Annotations | BACKEND DONE, UI IN PROGRESS | 6 annotation types, replies, draft/publish, HTML + annotated PDF export |
| D - SpeedGrader | BACKEND DONE, UI IN PROGRESS | Rubrics, scores, feedback, comments, publish/unpublish, attempts. Missing: comment bank, notifications |
| E - Similarity | SERVICE DONE, ENGINE IN PROGRESS | Course-scoped corpus, exclusions, source attribution. Missing: external corpus (BLOCKER-003), match groups |
| F - AI-Writing Assessment | IN PROGRESS (experimental) | Teacher-only routes + mandatory review. Validation BLOCKED (BLOCKER-002) |
| G - Integration | IN PROGRESS | Frontend + Playwright E2E being built |
| H - Hardening | NOT STARTED | Security review, benchmarks, CI pending |

## Run log
### 2026-10-18 19:00 UTC run (automation)
- Reconciled state: PR #2's B1 Prisma schema and B2 upload route had never run (no PostgreSQL in VM, no tests). Replaced with SQLite persistence (ADR-008).
- Built backend API: auth, courses, rubrics, assignments, submissions, extraction, annotations, grading, comments, exports, similarity/AI routes.
- Restored AI-writing assessment as an experimental, evidence-gated workstream (ADR-009).
- Untracked 1,840 committed `node_modules` files.
- Tests: backend 71 passing (Vitest + Supertest, real generated PDF/DOCX fixtures).
