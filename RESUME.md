# Resume Instructions

**Last updated**: 2026-11-18  
**Canonical branch**: `cursor/academic-review-lab-ba77` ([PR #4](https://github.com/patelvivek9111/mysl8te-feature-lab/pull/4)). This is the only integration branch (ADR-010).  
**Frozen**: `cursor/mysl8te-full-application-b175` (SQLite). Read it only to port remaining items listed in `TASK_QUEUE.md`. Do not commit to it.  
**Base to preserve**: `main`. Do not merge PR #4 yourself.

## Each automation run

1. Check running agents (cursor-cloud `list-cloud-agents`, status RUNNING) and open PRs (`gh pr list`). Do not start duplicate work.
2. Automation runs start on a fresh `cursor/...` branch. Reset it onto the canonical branch before working:
   `git fetch origin && git reset --hard origin/cursor/academic-review-lab-ba77`
3. Implement the top READY item in `TASK_QUEUE.md`, with tests.
4. Push fast-forward to both the run branch and the canonical branch:
   `git push origin HEAD && git push origin HEAD:cursor/academic-review-lab-ba77`
   Never force-push the canonical branch. If it moved, rebase onto it and re-run the tests first.
5. Update `TASK_QUEUE.md`, `PROGRESS.md`, and this file.

## Environment

```bash
bash .cursor/install.sh      # Node, PostgreSQL 16, poppler, Playwright Chromium, npm ci
bash .cursor/start.sh        # starts Postgres, runs migrations, API :3001, Vite :5173
```

Fresh VM without install having run: `sudo apt-get install -y postgresql poppler-utils unzip p7zip-full`, `sudo service postgresql start`, `sudo -u postgres createuser -s ubuntu`, `createdb -h /var/run/postgresql mysl8te_feature_lab`, `npm ci`, `cd backend && npx prisma generate && bash scripts/migrate.sh`, `cd ../frontend && npx playwright install --with-deps chromium`.

## Verify (must stay green)

```bash
cd backend && npm run typecheck && npm test     # 74 vitest unit + 27 node:test integration (PostgreSQL; needs poppler-utils)
cd ../frontend && npm run build && npx playwright test   # 8 E2E with video, starts both servers
```

Schema changes: edit `backend/prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` and commit the new migration folder. `scripts/migrate.sh` baselines databases created by the old `db push`.

## Demo accounts (seeded when `SEED_ON_BOOT=true`; boot resets their passwords)

- Instructor: `ada@demo.lab` / `DemoTeacher!2026`
- Students: `grace@demo.lab`, `alan@demo.lab` / `DemoStudent!2026`
- Course HIST210, Reading Public-Domain Prose

## Architecture map

- `backend/src/app.ts` routes; `services/` (auth sessions + password policy, rateLimit, access, extract, similarity service, AI assessment service, pdfExport); `worker.ts` background jobs; `seed.ts`.
- `backend/src/similarity/` k-gram engine (pure TS). `backend/src/ai-writing/` experimental signal module, evaluation harness, release gates (pure TS).
- `backend/prisma/` schema and migrations. `frontend/src/App.tsx`, `AiReviewCard.tsx`; `frontend/tests/` Playwright.

## Non-negotiables

- Do not modify the original MySL8TE application.
- No Turnitin-equivalence or AI-detection accuracy claims. AI-writing signals are teacher-only, show safeguards, and require a recorded teacher review. Consequential use stays off until the release gates in `docs/evaluations/AI_WRITING_RELEASE_GATES.md` pass on independent data.
- Release acceptance is not met. Do not declare production readiness until every gate in `ACCEPTANCE.md` passes.
