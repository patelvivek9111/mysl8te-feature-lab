# Resume Instructions - Cross-Run Continuation

**Last Updated**: 2026-10-18 19:15 UTC  
**Active branch**: `cursor/mysl8te-full-application-b175` (contains PR #2 and PR #3 merged in; supersedes them)

## 1. Orient (2 minutes)
```bash
cd /workspace && git status && git log --oneline -10
cat TASK_QUEUE.md BLOCKERS.md AGENT_STATUS.md
```
Check open PRs (`gh pr list`) and running agents (cursor-cloud list-cloud-agents) before starting work, to avoid duplicates.

## 2. Verify the build (must stay green)
```bash
cd /workspace && npm ci                       # if node_modules missing
cd backend && npm run typecheck && npx vitest run
cd ../frontend && npx playwright install --with-deps chromium   # fresh VM only
npm run build && npm run lint && npx playwright test
```

## 3. Run the app
```bash
cd backend && ALLOW_TEST_RESET=true npm run dev      # :3001, SQLite at backend/data/
cd frontend && npm run dev                           # :5173, proxies /api
curl -X POST 'http://localhost:3001/api/test/reset?seed=demo'   # demo data
```
Demo logins: `teacher@demo.test`, `alice@demo.test`, `bob@demo.test` / `demo-password-123`.

## 4. Pick work
Take the top READY item in `TASK_QUEUE.md`. Independent modules can go to parallel subagents with disjoint directories; the lead agent commits. Never mark a task DONE without passing tests.

## Architecture map
- `backend/src/app.ts` app factory; `routes/` (auth, courses, submissions, integrity); `auth/` (sessions, permissions); `db/database.ts` (migrations); `documents/` (detection, extraction, sanitizing, HTML/PDF export); `similarity/` (engine); `ai-writing/` (experimental signals, evaluation); `integrity/service.ts` (persistence of reports).
- `frontend/src` React app; `frontend/tests` Playwright E2E (videos in `frontend/test-results`).

## Non-negotiables
- Do not modify the original MySL8TE application; work only in this repo.
- No Turnitin-equivalence or AI-detection accuracy claims without evaluation evidence (ADR-009).
- AI-writing results: teacher-only, safeguards always shown, human review decision required.
