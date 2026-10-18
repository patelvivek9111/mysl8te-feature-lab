# Task Queue - Prioritized Executable Backlog

**Last Updated**: 2026-10-18 18:24 UTC  
**Current Phase**: Milestone B - Universal Document Engine

---

## Active Tasks (In Progress)

**None** - B1 just completed, ready to deploy parallel agents

---

## Recently Completed

### B1 - Database Schema Design ✅
- **Owner**: Agent 0
- **Status**: COMPLETE
- **Completed**: 2026-10-18
- **Duration**: ~30 minutes
- **Deliverables**: 600+ line Prisma schema, 23 models, client generated
- **Verification**: Schema validates, client generated successfully
- **Unblocked**: B2, B3, B5, C1, D1, E1 (20+ tasks)

---

## Ready Queue (Unblocked, Not Started)

### B2 - File Upload API  
- **Owner**: Unassigned → **DEPLOY NEXT**
- **Status**: READY (B1 unblocked this)
- **Priority**: P0
- **Dependencies**: ✅ B1 (database) - COMPLETE
- **Acceptance**: REST API accepts files, validates, stores metadata
- **Verification**: Unit tests pass, handles invalid files
- **Estimate**: 3-4 hours
- **Can Deploy**: NOW
- **Owner**: Unassigned
- **Status**: READY
- **Priority**: P0
- **Dependencies**: B2 (file upload)
- **Acceptance**: Magic byte detection for 15+ formats
- **Verification**: Correctly identifies all test files
- **Estimate**: 2-3 hours

### B4 - PDF Conversion Pipeline
- **Owner**: Unassigned
- **Status**: READY
- **Priority**: P0
- **Dependencies**: B3 (format detection)
- **Acceptance**: DOCX/DOC/RTF → PDF conversion working
- **Verification**: Converted PDFs render correctly
- **Estimate**: 4-6 hours

### B5 - Text Extraction Engine
- **Owner**: Unassigned → **DEPLOY NEXT**
- **Status**: READY (B1 unblocked this)
- **Priority**: P0
- **Dependencies**: ✅ B3 (format detection) or can start independently
- **Acceptance**: Extract text from PDF, DOCX, TXT, Markdown
- **Verification**: Extracted text matches source
- **Estimate**: 3-4 hours
- **Can Deploy**: NOW (parallel with B2, B3)

### B6 - Preview Generation
- **Owner**: Unassigned
- **Status**: READY
- **Priority**: P1
- **Dependencies**: B4 (conversion), B5 (extraction)
- **Acceptance**: Generate preview URLs for supported formats
- **Verification**: Previews load in browser
- **Estimate**: 3-4 hours

### B7 - OCR Integration
- **Owner**: Unassigned
- **Status**: READY
- **Priority**: P1
- **Dependencies**: B5 (text extraction)
- **Acceptance**: OCR text from scanned PDFs and images
- **Verification**: Extracted text is readable
- **Estimate**: 4-5 hours

### B8 - Document Processing Workers
- **Owner**: Unassigned
- **Status**: READY
- **Priority**: P0
- **Dependencies**: B2-B7 (all document processing)
- **Acceptance**: Background workers process uploads asynchronously
- **Verification**: Processing completes, handles failures, retries
- **Estimate**: 4-5 hours

---

## Blocked Queue (Dependencies Not Met)

### C1 - Annotation Data Model
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: B1 (database schema)
- **Dependencies**: Database schema, document model
- **Acceptance**: Annotation table with all fields
- **Estimate**: 2 hours

### C2 - Coordinate Mapping System
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: B6 (preview generation)
- **Dependencies**: Document preview working
- **Acceptance**: Percentage-based coordinates, zoom/rotate invariant
- **Estimate**: 6-8 hours

### C3 - Frontend Annotation Tools
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: C2 (coordinate system)
- **Dependencies**: Preview, coordinate mapping
- **Acceptance**: 6 annotation tools functional
- **Estimate**: 12-16 hours

### D1 - Assignment Management API
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: B1 (database schema)
- **Dependencies**: Database schema
- **Acceptance**: CRUD for assignments
- **Estimate**: 4-5 hours

### D2 - Submission API
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: B2 (file upload), D1 (assignments)
- **Dependencies**: File upload, assignments
- **Acceptance**: Submit documents to assignments
- **Estimate**: 3-4 hours

### D3 - Rubric Engine
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: D1 (assignments)
- **Dependencies**: Assignment model
- **Acceptance**: Rubric CRUD, criterion scoring
- **Estimate**: 6-8 hours

### E1 - Text Normalization
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: B5 (text extraction)
- **Dependencies**: Text extraction working
- **Acceptance**: Clean, normalized text for matching
- **Estimate**: 3-4 hours

### E2 - Full-Text Indexing
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: E1 (normalization)
- **Dependencies**: Normalized text
- **Acceptance**: PostgreSQL full-text or Elasticsearch
- **Estimate**: 4-6 hours

### E3 - Similarity Matching Algorithms
- **Owner**: Unassigned
- **Status**: BLOCKED
- **Priority**: P0
- **Blocking On**: E2 (indexing)
- **Dependencies**: Indexed corpus
- **Acceptance**: N-gram matching, LCS, fuzzy matching
- **Estimate**: 8-12 hours

---

## Backlog (Future Milestones)

### Milestone C Tasks (20+ tasks)
- Annotation persistence, editing, deletion
- Comment threading
- Draft/publish workflows
- Export with annotations

### Milestone D Tasks (15+ tasks)
- Grading interface
- Comment bank
- Student view
- Notification system

### Milestone E Tasks (12+ tasks)
- Source corpus management
- Exclusion rules
- Report generation
- Source attribution

### Milestone F Tasks (8+ tasks)
- Assignment design guidance
- Process documentation
- Educational resources

### Milestone G Tasks (10+ tasks)
- Module integration
- End-to-end workflows
- Performance optimization

### Milestone H Tasks (15+ tasks)
- Security audit
- Performance benchmarking
- Cross-browser testing
- Computer-use verification
- Independent review

---

## Task Assignment Strategy

### Parallel Execution Opportunities
- **Now**: B3 (format detection) and B5 (text extraction) can run in parallel
- **After B3/B5**: B4 (conversion) and B6 (preview) can run in parallel
- **After database**: C1 (annotations) and D1 (assignments) can run in parallel

### Model Routing
- **Database schema (B1)**: GPT-5.6 Sol Medium (structured data modeling)
- **File upload (B2)**: GPT-5.6 Sol Medium (backend API)
- **Format detection (B3)**: Composer 2.5 Fast (well-defined task)
- **Conversion/extraction (B4/B5)**: GPT-5.6 Sol Medium (integration complexity)
- **Frontend tools (C3)**: Claude Sonnet 5.5 High (React/UI)

### Agent Deployment Pattern
1. Start with database schema (blocking many tasks)
2. Deploy 2-3 parallel agents for document processing
3. Deploy frontend and backend agents separately
4. Use computer-use agent for verification after each milestone

---

## Next Executable Task

**B1 - Database Schema Design** (Agent 0, starting now)

After B1 completes: Deploy parallel agents for B2, B3, B5

---

**Queue Management**: Automatic selection of next unblocked task  
**Priority**: P0 (blocking) > P1 (important) > P2 (nice-to-have)  
**Status**: READY > IN PROGRESS > BLOCKED > COMPLETE
