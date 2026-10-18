# Resume Instructions - Cross-Run Continuation

**Last Updated**: 2026-10-18 18:24 UTC  
**Current Session**: Agent 0, Claude Sonnet 4.5  
**Branch**: cursor/mission-architecture-a522  
**Commit**: Latest on branch

---

## Current State

### What's Complete
- ✅ Milestone A (Research & Architecture) - 100%
- ✅ Mission management system created
- ✅ Canvas research (70+ sources, complete specifications)
- ✅ Turnitin research (40+ sources, critical decision made)
- ✅ Architecture designed (6 modules, data models, APIs)
- ✅ AI detection removed from scope (evidence-based decision)

### What's In Progress
- 🔄 Milestone B - Universal Document Engine
- 🔄 Task B1 - Database Schema Design (JUST STARTED)

### What's Next
- After B1: Deploy parallel agents for B2-B5 (file upload, format detection, extraction)
- After B2-B5: Conversion, preview, OCR, workers
- After Milestone B: Annotation system (Milestone C)

---

## How to Resume

### Step 1: Verify Repository State
```bash
cd /workspace
git status
git log --oneline -5
```

Check you're on `cursor/mission-architecture-a522` branch with latest commits.

### Step 2: Read Mission State Files
- `MISSION.md` - Immutable objectives
- `TASK_QUEUE.md` - Prioritized backlog
- `AGENT_STATUS.md` - Active/completed agents
- `PROGRESS.md` - Completed work
- `BLOCKERS.md` - Current blockers (should be empty)
- `DECISIONS.md` - Architectural decisions made

### Step 3: Identify Next Task
Look in `TASK_QUEUE.md` under "Active Tasks" or "Ready Queue".

**Current next task**: B1 - Database Schema Design (if not complete)

### Step 4: Check Dependencies
Before starting any task, verify:
- Dependencies are met (check TASK_QUEUE.md)
- No blockers exist (check BLOCKERS.md)
- Database/services running if needed

### Step 5: Continue Execution
- If B1 incomplete: Finish database schema
- If B1 complete: Deploy agents for B2-B5 (parallel execution)
- Update TASK_QUEUE.md as tasks complete
- Update PROGRESS.md with new completions
- Commit work frequently

---

## Critical Reminders

### Autonomous Execution
- **DO NOT** ask for permission between milestones
- **DO NOT** stop after planning or documentation
- **DO NOT** wait for approval to deploy agents
- **DO** continue through implementation → testing → fixing → verification
- **DO** fix bugs and errors autonomously
- **DO** deploy multiple agents when tasks are independent

### Quality Gates
- All code must have tests
- Critical features need computer-use verification
- Security-sensitive code needs review
- Performance must be benchmarked
- No features marked complete without evidence

### State Management
- Commit completed work frequently
- Update management files (TASK_QUEUE.md, PROGRESS.md, AGENT_STATUS.md)
- Record blockers in BLOCKERS.md
- Document decisions in DECISIONS.md
- Push to GitHub regularly

### Cost Management
- Use efficient models for routine tasks (Composer 2.5 Fast, Grok Fast)
- Use strong models for complex problems (Claude Opus, GPT Sol Medium)
- Avoid redundant research or unproductive retries
- Track usage in AGENT_STATUS.md

---

## If Environment Changed

### Missing Dependencies
1. Check `/workspace/BOOTSTRAP_REPORT.md` for setup instructions
2. Verify Node.js 24 via fnm: `fnm use 24`
3. Verify Playwright: `cd frontend && npx playwright --version`
4. Install missing packages: `npm install`

### Database Not Running
```bash
# If PostgreSQL needed but not running
# Check if Docker available, or use cloud database
# Document in BLOCKERS.md if infrastructure needed
```

### Tools Not Available
- REA: Can be set up when needed for analysis
- Ghidra: Already installed at `/workspace/ghidra_12.1.4_PUBLIC`
- Playwright: Installed in frontend/node_modules

---

## Quick Status Check

Run this to see current state:
```bash
cd /workspace
echo "=== Branch ===" && git branch --show-current
echo "=== Last Commit ===" && git log --oneline -1
echo "=== Modified Files ===" && git status --short
echo "=== Active Tasks ===" && grep "IN PROGRESS\|READY" TASK_QUEUE.md | head -5
echo "=== Blockers ===" && grep "ACTIVE" BLOCKERS.md || echo "None"
```

---

## Task Completion Checklist

When completing a task:
- [ ] Implementation code written
- [ ] Unit tests added
- [ ] Integration tests added (if applicable)
- [ ] Documentation updated
- [ ] Committed to git
- [ ] TASK_QUEUE.md updated (status → COMPLETE)
- [ ] PROGRESS.md updated (metrics, completions)
- [ ] AGENT_STATUS.md updated (if agent work)
- [ ] Next task identified and started

---

## Emergency Recovery

If session ends abruptly:
1. Check git log for last successful commit
2. Check PROGRESS.md for last update
3. Check TASK_QUEUE.md for in-progress tasks
4. Review branch for uncommitted work: `git diff`
5. Commit any salvageable work
6. Resume from last known good state

---

## Contact Points (When Necessary)

**Only interrupt user for**:
- External credentials needed
- Paid service authorization required
- Actions outside standalone lab
- Platform limits blocking execution
- Consequential decisions outside engineering judgment

**Do NOT interrupt for**:
- Dependency installation
- Code bugs or test failures
- Architectural implementation choices
- Agent deployment decisions
- Milestone progression

---

**Next Action**: Continue B1 (database schema) or next unblocked task in TASK_QUEUE.md  
**Execution Mode**: Autonomous, end-to-end ownership  
**Target**: Complete standalone release with evidence
