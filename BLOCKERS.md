# Blockers - Unresolved Dependencies

**Last Updated**: 2026-10-18 18:24 UTC  
**Active Blockers**: 0  
**Resolved Blockers**: 1

---

## Active Blockers

**None** - All current work is unblocked.

---

## Resolved Blockers

### ✅ BLOCKER-001: AI Detection Accuracy (RESOLVED - Scope Change)
- **Raised**: 2026-10-18 during research phase
- **Type**: Technical + Ethical
- **Impact**: Blocked AI detection implementation
- **Description**: Research showed 43% accuracy for hybrid content, 60% for humanized AI, significant bias concerns
- **Resolution**: Architectural decision to remove AI detection from scope, replace with Academic Integrity Guidance System
- **Resolved**: 2026-10-18
- **Decision Document**: docs/architecture/AI_DETECTION_DECISION.md

---

## Potential Future Blockers

### ⚠️ WATCH: Third-Party Service Dependencies
- **Risk**: OCR, document conversion, or AI services may require paid APIs
- **Mitigation**: Use open-source alternatives (tesseract.js, LibreOffice) as primary
- **Fallback**: Cloud APIs only if needed, with cost approval
- **Status**: MONITORING

### ⚠️ WATCH: PostgreSQL vs Elasticsearch
- **Risk**: Full-text search performance may require Elasticsearch
- **Mitigation**: Start with PostgreSQL full-text, benchmark, upgrade if needed
- **Impact**: May need infrastructure setup
- **Status**: DEFERRED (test PostgreSQL first)

### ⚠️ WATCH: Large File Processing
- **Risk**: 100MB files may timeout or exhaust memory
- **Mitigation**: Stream processing, chunking, background workers
- **Impact**: May need architecture adjustment
- **Status**: MONITORING (test with real files)

---

## Escalation Criteria

Escalate to user only when:
1. External credentials or paid service authorization needed
2. Architectural decision requires policy clarification
3. Platform or quota limits prevent further execution
4. Consequential decision outside engineering judgment

**Do NOT escalate**: Installation failures, dependency conflicts, coding bugs, test failures, ordinary architectural choices

---

**Current Status**: No active blockers, Milestone B proceeding
