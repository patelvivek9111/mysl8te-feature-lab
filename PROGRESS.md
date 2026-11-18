# Progress

**Last updated**: 2026-11-18  
**Release status**: not accepted

| Area | State |
| --- | --- |
| Branches | Unified on `cursor/academic-review-lab-ba77` (ADR-010). SQLite branch frozen after porting its engines. |
| Persistence | PostgreSQL 16 + Prisma with versioned migrations. |
| Authentication | Opaque bearer tokens stored hashed in `sessions` (12 h absolute, 2 h idle), logout, sign out everywhere, password change with policy that revokes other sessions, failure-based rate limiting (per IP+email and per IP), generic login errors, security headers, 400/413 for bad JSON and uploads. |
| Teacher and student workspaces | Working for the seeded course: upload, review, draft/publish, rubric, transcript download. |
| Document engine | Tested TXT, Markdown, CSV, source, PDF, DOCX, ZIP listing, PNG preview. Other formats are stored or partially handled. |
| Annotations | Text-offset highlight, underline, point comments. No reply threads in UI yet; not glyph-accurate PDF markup. |
| Similarity | Independent k-gram engine with NEAR matching, exclusions, ranked attribution against reference texts and peer submissions; classmates' names and text redacted for students. Not a plagiarism finding, not Turnitin. |
| AI-writing assessment | Experimental signal module, teacher-only, uncertainty band, safeguards, mandatory recorded teacher review. 0 of 6 release gates met. |
| Tests (2026-11-18) | Backend 61 unit + 25 integration passed (also on a freshly reset database); typecheck clean; frontend build passed, lint 4 pre-existing warnings; Playwright 8 passed (run twice). |
| Demo | Local preview at port 5173. No public HTTPS deployment. |
