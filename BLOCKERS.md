# Blockers - Unresolved Dependencies

**Last Updated**: 2026-10-18 19:15 UTC

## Active Blockers

### BLOCKER-002: Independent labeled dataset for AI-writing evaluation
- **Impact**: AI-writing assessment cannot leave EXPERIMENTAL; no accuracy may be claimed (ADR-009).
- **Needed from owner**: an authorized, consented labeled corpus (human / AI-generated / AI-paraphrased / hybrid), including non-native English writers and multiple disciplines, sized per the release gates in `docs/evaluations/AI_WRITING_RELEASE_GATES.md`. Synthetic self-written samples are not acceptable evidence.
- **Workaround**: harness + smoke dataset prove the plumbing; the feature stays teacher-only with mandatory human review.

### BLOCKER-003: External source corpus for similarity
- **Impact**: Similarity compares only against instructor reference sources and other students' papers in the same course. No internet or publication matching.
- **Needed from owner**: decision on a licensed search/publication API (cost + terms) or a provided corpus.
- **Workaround**: teachers add reference sources per course; limitation disclosed in every report.

## Resolved
- **BLOCKER-001** (AI detection accuracy): originally resolved by cancelling the feature; superseded by ADR-009, now tracked as BLOCKER-002.
- **PostgreSQL unavailable**: resolved by ADR-008 (SQLite via node:sqlite).

## Watch list
- `node:sqlite` is experimental in Node 22/24 (stable API so far; pinned by tests).
- OCR (tesseract.js) and Office-to-PDF conversion (LibreOffice) need extra downloads in `.cursor/install.sh`.
- Ghidra (5k files) is committed to git and required by `install.sh`; consider moving to a download step.
