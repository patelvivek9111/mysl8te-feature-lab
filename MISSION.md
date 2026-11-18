# MySL8TE Feature Lab - Mission Definition

**Status**: ACTIVE  
**Started**: 2026-10-18  
**Repository**: patelvivek9111/mysl8te-feature-lab  
**Lead**: Agent 0 - Lead Engineering Orchestrator

---

## Mission Objective

Build a standalone academic review lab for document preview, grading, similarity overlap, and experimental AI-writing assessment. Original software only. AI scores are not proof of misconduct and consequential use stays disabled until a real benchmark exists. The production MySL8TE app is out of scope.

**This is NOT a prototype. This is NOT a mockup. This is a real, functioning system.**

---

## Core Features (Revised Post-Research)

### 1. Canvas DocViewer - APPROVED ✅
Complete document preview and annotation system:
- 6 annotation types (Point, Area, Highlight, Strikeout, Free Draw, Free Text)
- Comment threading and replies
- Draft/published feedback workflows
- 15+ document format support
- Coordinate system (upper-left origin, percentage-based)
- Session management and autosave
- Mobile support
- Accessibility features

### 2. Canvas SpeedGrader - APPROVED ✅
Complete teacher/student grading workflows:
- Submission queue and navigation
- Rubric-based grading
- Multiple grade types
- Comment bank
- Draft vs. published feedback
- Student visibility controls
- Notification system
- Version handling
- Grading history

### 3. Turnitin Similarity Detection - APPROVED ✅
Independent plagiarism similarity detection:
- Text extraction and normalization
- Full-text indexing
- Similarity matching algorithms
- Source attribution
- 4 match groups (Not Cited/Quoted, Missing Quotations, Missing Citation, Cited & Quoted)
- Exclusion controls
- Report generation
- Must disclose differences from Turnitin

### 4. Experimental AI-writing assessment - RESTORED
The product owner reversed the earlier cancellation. The lab includes a non-consequential writing-signal report with uncertainty, human review, and synthetic-fixture disclosure. It is not proof of authorship and not a Turnitin equivalent.

---

## Universal Document Support

Target 40+ formats across:
- Word processing (PDF, DOCX, DOC, RTF, ODT, TXT, Markdown)
- Spreadsheets (XLSX, XLS, ODS, CSV)
- Presentations (PPTX, PPT, ODP)
- Images (PNG, JPG, WEBP, TIFF, BMP, HEIC, SVG)
- Code (Python, JavaScript, TypeScript, Java, C/C++, C#, HTML, CSS, JSON, XML, SQL)
- Archives (ZIP, TAR, 7Z)
- Audio/Video (MP3, WAV, MP4, MOV, WEBM)
- Other (EPUB, LaTeX)

Each format requires: upload, preview, text extraction, annotation support, similarity checking

---

## Critical Constraints

### Absolute Requirements
- ✅ No modification to existing MySL8TE application
- ✅ All work in standalone mysl8te-feature-lab repository
- ✅ Real implementation code (no mockups)
- ✅ Functioning backend behavior
- ✅ Persistent data storage
- ✅ Verifiable test evidence
- ✅ Independent deployability

### Quality Gates
- All features must have functioning implementation
- All claims require verification evidence
- No fabricated test results
- No invented reference behavior
- Clear documentation of limitations
- Security review required
- Performance benchmarks required
- Independent code review required

### Ethical Boundaries
- Use only authorized test accounts
- Use only public documentation
- No authentication bypass
- No access control circumvention
- No confidential data harvesting
- No proprietary model extraction
- Honest disclosure of capabilities

---

## Technology Stack

### Frontend
- React 19.2.8 + TypeScript 6.0.2 + Vite 8.3.0
- UI components: TBD
- State management: React Context + Hooks

### Backend
- Node.js 24.22.0 + Express 4.18.2 + TypeScript 5.3.3
- Database: PostgreSQL 16+
- Job Queue: BullMQ + Redis
- WebSocket: Socket.io

### Document Processing
- PDF: pdf-lib, pdfjs-dist
- Word: mammoth, docx
- Spreadsheets: xlsx
- Images: sharp
- OCR: tesseract.js or Cloud Vision API
- Conversion: GroupDocs approach

### Search & Indexing
- PostgreSQL full-text or Elasticsearch
- Vector search: pgvector (if needed)

### Testing
- Unit: Jest
- E2E: Playwright 1.64.1
- API: Supertest
- Computer-use: Cursor agents

---

## Milestones

### ✅ Milestone A - Research & Architecture (COMPLETE)
- [x] Bootstrap validation
- [x] Canvas research
- [x] Turnitin research
- [x] Architecture design
- [x] Critical decisions

### 🔄 Milestone B - Universal Document Engine (IN PROGRESS)
- [ ] File upload and validation
- [ ] Format detection
- [ ] Document conversion pipeline
- [ ] Text extraction
- [ ] Preview generation
- [ ] OCR integration

### ⏳ Milestone C - DocViewer & Annotation System
- [ ] Annotation data model
- [ ] Coordinate system
- [ ] 6 annotation tools
- [ ] Comment threading
- [ ] Persistence layer
- [ ] Export with annotations

### ⏳ Milestone D - SpeedGrader & Feedback
- [ ] Assignment management
- [ ] Submission handling
- [ ] Rubric engine
- [ ] Grading interface
- [ ] Draft/publish workflow
- [ ] Notification system

### ⏳ Milestone E - Similarity Detection
- [ ] Text processing pipeline
- [ ] Full-text indexing
- [ ] Matching algorithms
- [ ] Source corpus management
- [ ] Exclusion rules
- [ ] Report generation

### Milestone F - Experimental AI-writing assessment
- [x] Heuristic document-level outcome with inconclusive results
- [x] Consequential use hardcoded off and human review required
- [ ] Independent real-world benchmark before any consequential use

### ⏳ Milestone G - Full-System Integration
- [ ] Module integration
- [ ] End-to-end workflows
- [ ] Cross-module testing
- [ ] Performance optimization

### ⏳ Milestone H - Hardening & Final Acceptance
- [ ] Security audit
- [ ] Performance benchmarking
- [ ] Cross-browser testing
- [ ] Computer-use verification
- [ ] Independent review
- [ ] Final evidence package

---

## Success Criteria

The mission is complete when:

1. ✅ Standalone application installs and starts reproducibly
2. ⏳ Teacher and student workflows operate end to end
3. ⏳ Supported document formats have verified processing
4. ⏳ Annotation tools work with persistent storage
5. ⏳ Comments, drafts, and publication function correctly
6. ⏳ Annotation coordinates remain accurate
7. ⏳ Exports contain expected annotations
8. ⏳ Grading and rubric workflows work
9. ⏳ Similarity detection returns real source-grounded results
10. ⏳ Similarity filters and exclusions work
11. ⏳ Automated regression tests pass
12. ⏳ Independent browser tests pass
13. ⏳ Successful workflow recordings exist
14. ⏳ Critical permissions are independently verified
15. ⏳ Data isolation is enforced
16. ⏳ Security review is completed
17. ⏳ Performance benchmarks are recorded
18. ⏳ Known limitations are documented
19. ⏳ No unresolved critical or high-severity defects remain
20. ⏳ No unverified feature is described as fully supported
21. ⏳ Complete system can be demonstrated using real sample submissions
22. ⏳ Module boundaries and integration contracts are documented
23. ✅ Original MySL8TE application remains untouched

---

## Immutable Requirements

This mission definition represents the binding scope established from the original requirements and validated through research.

Changes to core scope require documented architectural decisions with research evidence.

**Mission Control**: Agent 0 - Lead Engineering Orchestrator  
**Execution Model**: Autonomous end-to-end ownership  
**Quality Standard**: Production-grade, verifiable, honest
