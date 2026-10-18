# Architectural Decisions Log

**Repository**: mysl8te-feature-lab  
**Decision Authority**: Agent 0 - Lead Engineering Orchestrator (with research evidence)

---

## ADR-001: Remove AI Writing Detection from Scope

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Do not build AI writing detection feature  
**Context**: Comprehensive research by Agent 2 on Turnitin AI detection

### Problem
Original mission included AI-generated and AI-paraphrased writing detection. Research revealed significant technical and ethical issues.

### Research Evidence
- **Accuracy**: 43% for hybrid human-edited AI, 60% for humanized AI (peer-reviewed research)
- **Bias**: Non-native speakers and neurodivergent students flagged at higher rates
- **Institutional Response**: Vanderbilt University disabled feature campus-wide citing "unreliable results"
- **Turnitin Disclaimer**: "may not always be accurate", "should not be used as sole basis for adverse actions"
- **Legal Risk**: False accusations create liability

### Decision
**REMOVE AI writing detection from scope.**

Replace with **Academic Integrity Guidance System** (pedagogical tools, not detection).

### Rationale
1. Cannot build genuinely accurate system (43-60% accuracy)
2. High false positive rates create unacceptable liability
3. Discriminatory bias against vulnerable populations
4. Contradicts mission requirements for verifiable, honest implementation
5. Major institutions are disabling this feature

### Consequences
- **Positive**: Avoid building harmful system, focus on reliable features
- **Negative**: One fewer feature than original 4
- **Mitigation**: Add pedagogical guidance system as alternative

### Alternatives Considered
1. Build it anyway and disclose limitations - **Rejected** (still creates liability)
2. Use third-party API - **Rejected** (same accuracy/bias issues)
3. Defer to future work - **Rejected** (problem is fundamental, not technical)

### References
- Full research: docs/research/TURNITIN_AI_DETECTION_RESEARCH.md
- Decision document: docs/architecture/AI_DETECTION_DECISION.md
- Academic papers: 9 peer-reviewed sources cited

---

## ADR-002: PostgreSQL as Primary Database

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Use PostgreSQL 16+ as primary database

### Context
Need to select database for document metadata, annotations, submissions, grades, users.

### Decision
Use **PostgreSQL 16+** with:
- Full-text search (initially)
- JSON columns for flexible metadata
- Row-level security for multi-tenancy
- pgvector extension (if needed for semantic search)

### Rationale
1. Strong full-text search capabilities (good enough for initial release)
2. JSON support for document metadata
3. ACID compliance for grading/submission data
4. Row-level security for data isolation
5. Wide tooling support
6. Can upgrade to Elasticsearch later if needed

### Alternatives Considered
1. MongoDB - **Rejected** (prefer relational for grading data)
2. MySQL - **Rejected** (PostgreSQL has better full-text search)
3. Elasticsearch only - **Rejected** (need ACID for grades)

### Future Review
If full-text search performance inadequate, add Elasticsearch as search layer while keeping PostgreSQL for transactional data.

---

## ADR-003: React + TypeScript Frontend

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Use React 19.2.8 + TypeScript 6.0.2 + Vite 8.3.0

### Context
Frontend framework choice for document viewer and grading interface.

### Decision
**React 19.2.8 + TypeScript + Vite** (already in bootstrap)

### Rationale
1. Already set up and working from bootstrap
2. Large ecosystem for PDF rendering, annotations
3. TypeScript provides type safety
4. Vite offers fast development experience
5. Good Playwright integration for testing

### Alternatives Considered
- Vue.js - **Rejected** (React ecosystem better for PDF/canvas work)
- Svelte - **Rejected** (smaller ecosystem)
- Angular - **Rejected** (heavier framework)

---

## ADR-004: Node.js + Express Backend

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Use Node.js 24.22.0 + Express 4.18.2 + TypeScript

### Context
Backend framework choice.

### Decision
**Node.js + Express + TypeScript** (already in bootstrap)

### Rationale
1. Already set up and working
2. Good performance for I/O-heavy document processing
3. TypeScript shares types with frontend
4. Large ecosystem for document conversion
5. Easy background job processing with BullMQ

### Alternatives Considered
- Python + FastAPI - **Rejected** (separate type systems, but good for ML if needed)
- Go - **Rejected** (less document processing libraries)
- Java/Spring - **Rejected** (heavier stack)

---

## ADR-005: Percentage-Based Annotation Coordinates

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Store annotation coordinates as percentages (0-100), not absolute pixels

### Context
Canvas DocViewer research showed annotations must remain accurate across zoom, rotation, screen sizes.

### Decision
Store coordinates as **percentages** relative to document dimensions:
- `x`: 0-100 (percentage from left)
- `y`: 0-100 (percentage from top)
- `width`: 0-100 (percentage of document width)
- `height`: 0-100 (percentage of document height)

### Rationale
1. Zoom-invariant (scales with document)
2. Resolution-independent (works on any screen)
3. Matches Canvas implementation pattern
4. Easier to export/import annotations

### Alternatives Considered
1. Absolute pixels - **Rejected** (breaks on zoom/rotation)
2. PDF units - **Rejected** (harder to work with in browser)
3. Viewport percentages - **Rejected** (breaks on scroll/zoom)

---

## ADR-006: Background Workers for Document Processing

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Use BullMQ + Redis for asynchronous document processing

### Context
Document conversion, text extraction, OCR can take seconds to minutes.

### Decision
**BullMQ + Redis** for:
- Document conversion jobs
- Text extraction jobs
- OCR processing
- Similarity report generation
- Any long-running task

### Rationale
1. Turnitin research showed processing takes 10 seconds to 15 minutes
2. Canvas research showed conversion can take up to 10 minutes
3. Non-blocking API responses improve UX
4. Retry logic for transient failures
5. Progress tracking for long jobs

### Alternatives Considered
1. Synchronous processing - **Rejected** (timeouts, poor UX)
2. AWS Lambda - **Rejected** (increases deployment complexity)
3. Custom worker implementation - **Rejected** (reinventing wheel)

---

## ADR-007: Independent Similarity Algorithm (Not Turnitin Clone)

**Date**: 2026-10-18  
**Status**: ACCEPTED  
**Decision**: Build independent similarity detection, disclose differences from Turnitin

### Context
Turnitin's exact algorithm is proprietary. Research documented observable behavior but not implementation.

### Decision
Build **independent implementation** using:
- N-gram shingling for passage detection
- Fuzzy matching for near-duplicates
- Longest common substring for exact matches
- PostgreSQL full-text search for corpus indexing

**Must disclose**: This is NOT Turnitin, results will differ.

### Rationale
1. Cannot access Turnitin's proprietary algorithm
2. Cannot access Turnitin's 90B+ page corpus
3. Research provides observable behavior for validation
4. Academic baseline: 82.4% effectiveness for verbatim plagiarism
5. Honest disclosure maintains mission integrity

### Alternatives Considered
1. Claim identical to Turnitin - **Rejected** (false, unethical)
2. Reverse engineer Turnitin - **Rejected** (likely illegal, definitely unethical)
3. Skip similarity detection - **Rejected** (core feature)

---

## Template for Future Decisions

### ADR-XXX: [Decision Title]

**Date**: YYYY-MM-DD  
**Status**: PROPOSED | ACCEPTED | REJECTED | SUPERSEDED  
**Decision**: [One-sentence summary]

#### Context
[Describe the situation requiring a decision]

#### Decision
[What was decided]

#### Rationale
[Why this decision makes sense]

#### Alternatives Considered
[What else was evaluated]

#### Consequences
[Positive and negative impacts]

#### References
[Links to research, discussions, documentation]

---

**Decision-Making Process**: Evidence-based, documented, reversible  
**Decision Authority**: Agent 0 with research evidence  
**Review Trigger**: Significant new information or implementation blockers
