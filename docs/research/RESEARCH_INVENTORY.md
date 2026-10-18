# Research Inventory

## Purpose
Track all research findings from Canvas, Turnitin, and related reference systems.

## Research Classification

### Evidence Levels
- **OBSERVED**: Directly witnessed through authorized testing and interaction
- **DOCUMENTED**: Found in official documentation, public resources
- **INFERRED**: Reasoned from observable behavior but not directly verified
- **UNAVAILABLE**: Explicitly known to be inaccessible (e.g., proprietary algorithms)

---

## Canvas DocViewer Research

### Investigation Status
- **Status**: ✅ COMPLETE
- **Lead Agent**: Agent 1
- **Method**: Public documentation research, official API documentation, community resources
- **Start Date**: 2026-10-18
- **Last Update**: 2026-10-18
- **Documentation**: `/workspace/docs/research/CANVAS_DOCVIEWER_RESEARCH.md`

### Features Investigated
1. [✅] Document rendering (PDF, Word, etc.) - **DOCUMENTED**
2. [✅] Zoom and navigation controls - **DOCUMENTED**
3. [✅] Text selection and search - **DOCUMENTED**
4. [✅] Highlighting tools (color, opacity) - **DOCUMENTED**
5. [✅] Underlining and strikethrough - **DOCUMENTED**
6. [✅] Freehand drawing tools - **DOCUMENTED**
7. [✅] Text annotations and comments - **DOCUMENTED**
8. [✅] Point comments (click-to-comment) - **DOCUMENTED**
9. [✅] Digital sticky notes (Free Text annotations) - **DOCUMENTED**
10. [✅] Annotation editing (move, resize, delete) - **DOCUMENTED**
11. [✅] Undo/redo functionality - **DOCUMENTED**
12. [✅] Annotation persistence and autosave - **DOCUMENTED**
13. [✅] Concurrent modification handling - **DOCUMENTED**
14. [✅] Version history (submission versions) - **DOCUMENTED**
15. [✅] Comment threads and replies - **DOCUMENTED**
16. [✅] Annotation permissions - **DOCUMENTED**
17. [✅] Export with annotations - **DOCUMENTED**
18. [✅] Keyboard shortcuts - **DOCUMENTED**
19. [✅] Accessibility features - **DOCUMENTED**
20. [✅] Mobile/responsive behavior - **DOCUMENTED**

### Key Findings Summary

**Core Capabilities**:
- 6 annotation types: Point, Area, Highlight, Strikeout, Free Draw, Free Text
- Comment system with threading and replies
- 10-hour session with autosave (1 hour on mobile)
- Cross-platform sync (web and mobile)
- Export to annotated PDF
- Upper-left origin coordinate system (page-relative)

**File Support**:
- Converts all documents to PDF for rendering
- 100 MB file size limit, 999 page limit
- Supports Word, Excel, PowerPoint, PDF, images, OpenDocument, iWork (US only)
- GroupDocs and LibreOffice converters

**Critical Constraints**:
- Cannot rotate pages with annotations
- Cannot annotate rotated pages
- Password-protected files not supported
- 10-minute conversion time possible
- Session expiration warnings (10h on web, 1h on mobile)

**Technical Architecture**:
- PDF.js rendering engine
- Zero-indexed page numbers
- Server-side annotation storage
- JWT-based session security
- Coordinate system: upper-left origin, rect/coords properties per type

---

## Canvas SpeedGrader Research

### Investigation Status
- **Status**: ✅ COMPLETE
- **Lead Agent**: Agent 1
- **Method**: Public documentation research, official Canvas Community KB, API documentation
- **Start Date**: 2026-10-18
- **Last Update**: 2026-10-18
- **Documentation**: `/workspace/docs/research/CANVAS_SPEEDGRADER_RESEARCH.md`

### Features Investigated
1. [✅] Submission queue and navigation - **DOCUMENTED**
2. [✅] Student selector - **DOCUMENTED**
3. [✅] Assignment metadata display - **DOCUMENTED**
4. [✅] Grade entry interface - **DOCUMENTED**
5. [✅] Grading rubrics - **DOCUMENTED**
6. [✅] Per-criterion feedback - **DOCUMENTED**
7. [✅] General comment system - **DOCUMENTED**
8. [✅] Inline annotations (via DocViewer) - **DOCUMENTED**
9. [✅] Draft vs. published feedback - **DOCUMENTED**
10. [✅] Publication workflow - **DOCUMENTED**
11. [✅] Student reply functionality - **DOCUMENTED**
12. [✅] Submission version handling - **DOCUMENTED**
13. [✅] Grading history - **DOCUMENTED**
14. [✅] Notification system - **DOCUMENTED**
15. [✅] Downloadable feedback - **DOCUMENTED**
16. [✅] Permission model - **DOCUMENTED**
17. [✅] Audit trails - **DOCUMENTED**

### Key Findings Summary

**Core Capabilities**:
- Unified grading interface embedded in browser
- Rubric system with 3 views (Traditional, Horizontal, Vertical)
- Rich comments (text, audio, video, file attachments)
- DocViewer integration for inline annotations
- Draft and published feedback workflows
- Manual and automatic grade posting policies
- Keyboard shortcuts (j/k navigation, c/g/r shortcuts)

**Rubric System**:
- Criteria with up to 5 ratings each
- Point values or ranges per rating
- Criterion-specific comments
- Outcome integration for mastery tracking
- "Use this rubric for grading" checkbox
- Auto-population of grade field
- Free-form comment rubrics supported

**Grade Posting**:
- Manual posting policy (recommended): grades hidden until posted
- Automatic posting: immediate visibility to students
- Post options: Everyone, Graded only, Specific Sections
- Eye icon indicators (slash = hidden, no slash = posted)

**Version Handling**:
- Multiple submission attempts supported
- "Submission to View" dropdown for versions
- Warning when viewing non-latest submission
- "Use same grade for resubmission" feature
- Students cannot view own previous attempts

**Grading History**:
- 365-day retention of grade changes
- Filterable by student, grader, assignment, date
- Shows before/after/current grades
- API access via Grade Change Log endpoints
- Anonymous assignment handling

**Concurrent Grading Limitations**:
- Designed for one grader per student at a time
- Browser caching causes data loss risks
- Safe: DocViewer annotations, sidebar comments (concurrent)
- Unsafe: Rubrics, grades, quiz scores (concurrent)
- Solutions: Time-based scheduling or section-based assignment

**Performance**:
- 1500+ submissions: delayed load times
- 2500+ submissions: may fail to load
- Recommendation: Use section filters

---

## Turnitin Similarity Detection Research

### Investigation Status
- **Status**: ✅ COMPLETE
- **Lead Agent**: Agent 2
- **Method**: Public documentation review, official guides, academic papers, video demonstrations
- **Start Date**: 2026-10-18
- **Last Update**: 2026-10-18

### Features Investigated
1. [x] Document upload and processing
2. [x] Similarity percentage calculation
3. [x] Source matching behavior
4. [x] Passage-level highlighting
5. [x] Source attribution display
6. [x] Overlapping source resolution
7. [x] Source navigation
8. [x] Quote exclusions
9. [x] Bibliography exclusions
10. [x] Small-match exclusions
11. [x] Configurable thresholds
12. [x] Recalculation after exclusions
13. [x] Report storage and revisions
14. [x] Instructor control panel
15. [x] Source evidence display
16. [x] Report export formats
17. [x] Cross-submission matching
18. [x] Different document format handling

### Key Findings

**Observable Behaviors** (DOCUMENTED):
- Formula: Similarity % = (Matching Words / Total Words) × 100
- Minimum 20 words required for report generation
- Processing time: 10 seconds to 15 minutes typically
- Four match groups: Not Cited/Quoted, Missing Quotations, Missing Citation, Cited and Quoted
- Citation detection uses ML trained on APA, MLA, Turabian, IEEE formats
- Sources prioritized: Internet > Publications > Submitted Works
- Exclusion filters: quotes, bibliography, citations, small matches (≥8 words minimum)
- Export formats: PDF (Similarity Report, Grading Report, Original File)
- Bulk download available in Standard assignments
- Resubmissions: First 3 immediate, 4th+ requires 24-hour wait

**Technology Approach** (DOCUMENTED - High Level):
- "Fingerprinting" method: Documents broken into phrases with unique IDs
- Common words removed, meaningful phrases extracted
- Up to 80,000 phrase IDs per document
- Compared against 7 trillion possible phrase matches
- Natural language processing reduces false positives
- Detects hidden text and character replacement

**Database Composition** (DOCUMENTED):
- 90+ billion web pages (current and archived)
- 170+ million academic articles (journals, publications)
- 1.2+ billion previously submitted student papers
- Crossref content (published and posted scholarly works)

**Official Disclaimers** (DOCUMENTED):
- "Turnitin does NOT check for plagiarism" - only text similarity
- "There is NO acceptable similarity score" - context-dependent
- "Close review of suspected material is essential" - human judgment required

**Academic Research Findings** (DOCUMENTED):
- 82.4% detection rate for verbatim plagiarism (2009 study)
- 16.8% combined false-positive rate
- Effective for exact copying, inconsistent for paraphrasing
- Common references and phrases frequently flagged
- Cannot assess semantic plagiarism
- Deterrent effect demonstrated when students aware of use

### Known Limitations
- **UNAVAILABLE**: Exact fingerprinting algorithm implementation
- **UNAVAILABLE**: Natural language processing heuristics
- **UNAVAILABLE**: Source corpus composition details and partnerships
- **UNAVAILABLE**: Server-side processing architecture
- **UNAVAILABLE**: Exact scoring formulas and match weighting
- **UNAVAILABLE**: False positive reduction techniques
- **CANNOT DETECT**: Well-executed paraphrasing, semantic plagiarism, translation plagiarism, content not in database

### Detailed Documentation
See: `/workspace/docs/research/TURNITIN_SIMILARITY_RESEARCH.md` (comprehensive 19-section report)

---

## Turnitin AI Writing Detection Research

### Investigation Status
- **Status**: ✅ COMPLETE
- **Lead Agent**: Agent 2
- **Method**: Public documentation review, official guides, academic research papers
- **Start Date**: 2026-10-18
- **Last Update**: 2026-10-18

### Features Investigated
1. [x] AI-generated text detection
2. [x] AI-paraphrased text detection
3. [x] Human-written text classification
4. [x] Mixed content handling
5. [x] Confidence scoring
6. [x] Passage-level highlighting
7. [x] Report format
8. [x] Different AI model detection
9. [x] Language support
10. [x] Document length effects
11. [x] Editing detection
12. [x] Report settings and controls
13. [x] Integration with Similarity Report

### Key Findings

**Feature Description** (DOCUMENTED):
- Paid add-on feature (license required)
- Detects AI-generated, AI-paraphrased, and AI-bypassed (humanized) text
- Provides percentage score of qualifying text likely AI-generated
- Separate from similarity detection (different tab, independent score)
- Integrated into Similarity Report interface

**File Requirements** (DOCUMENTED):
- Min 300 words of qualifying text (prose)
- Max 30,000 words
- Max 100 MB file size
- Supported formats: .docx, .pdf, .txt, .rtf
- Supported languages: English, Spanish, Japanese, Arabic

**Qualifying Text Definition** (DOCUMENTED):
- Long-form prose sentences in paragraphs
- Essays, dissertations, articles
- **NOT**: poetry, scripts, code, bullet points, tables, annotated bibliographies

**Detection Categories** (DOCUMENTED - English Only):
1. AI-generated only (cyan highlighting) - LLM output, possibly bypasser-modified
2. AI-generated + paraphrased (purple highlighting) - LLM output modified by paraphraser (e.g., Quillbot)
- Spanish/Japanese/Arabic: Only AI-generated detection (no paraphraser/bypasser detection)

**Confidence Scoring** (DOCUMENTED):
- 0%: No AI detected
- 1-19%: Displayed as `*%` (asterisk) due to high false positive rate - no numeric score shown
- 20-100%: Numeric percentage displayed
- Change implemented July 8, 2024

**False Positive Rates** (DOCUMENTED):
- Document-level: <1% claimed by Turnitin (for 20%+ scores)
- Sentence-level: ~4% (individual sentences unreliable)
- Institutional guidance: Only focus on >20% scores

**Critical Disclaimers** (DOCUMENTED):
> "May not always be accurate (may misidentify human-written, AI-generated, and AI-paraphrased text)"
> "Should NOT be used as the sole basis for adverse actions against a student"
> "Requires further scrutiny and human judgment"

**Academic Research Findings** (DOCUMENTED):
- Temple University (2024): 93% human accuracy, 77% AI accuracy, 63% disguised AI accuracy, only 43% hybrid accuracy
- Robustness Study (2024): Only 60% accuracy for humanized AI (near random), 21% sensitivity, 34% F1 score
- O-1 Model Study (2025): GPT-5 text more likely misclassified as human than GPT-4o (evolving AI models evade detection better)

**Institutional Responses** (DOCUMENTED):
- Vanderbilt University: **Disabled Turnitin AI detector** due to false positive concerns, lack of transparency, bias concerns
- University of Melbourne: Second evidence piece required, never use AI score alone
- Multiple institutions report bias concerns: non-native English speakers, neurodivergent students, formulaic writing flagged more frequently

**Language Support**:
- English: Full detection (AI-generated + paraphrased + bypasser)
- Spanish/Japanese/Arabic: AI-generated only (no paraphraser/bypasser detection)

### Known Limitations
- **UNAVAILABLE**: Model architecture details
- **UNAVAILABLE**: Training data composition, sources, volume
- **UNAVAILABLE**: Exact confidence calculation methods
- **UNAVAILABLE**: Model update frequency and retraining schedule
- **UNAVAILABLE**: Detection patterns and feature engineering
- **UNAVAILABLE**: Specific signals that indicate AI writing
- **CANNOT DETECT**: Heavily edited AI text, newer AI models (GPT-5+), prompt-engineered outputs, recursively paraphrased text, humanized AI text
- **BIAS RISKS**: May disproportionately flag non-native speakers, neurodivergent writers, formulaic/technical writing
- **UNRELIABLE FOR**: Non-prose (code, poetry, tables), short-form (<300 words), mixed prose/non-prose documents

### Independent Development Notes
Since Turnitin's AI detection is proprietary:
1. Must develop independent detection system (consider open models, commercial APIs, or custom training)
2. Require rigorous evaluation dataset creation (human, AI-generated, hybrid, paraphrased, edited)
3. Must measure and document accuracy metrics (FPR, FNR, precision, recall, F1 score per AI model)
4. Cannot claim identical performance to Turnitin
5. Must disclose differences, limitations, and biases
6. Consider NOT building AI detection feature given controversies, limitations, and risks
7. If building: Emphasize probabilistic nature, require contextual review, never sole evidence

### Ethical Considerations
- **Strong Institutional Hesitation**: Major universities disabling or restricting use
- **False Accusation Risks**: Legal/ethical liability from incorrect flags
- **Bias Concerns**: Discriminatory impact on vulnerable student populations
- **Evolving Technology**: Arms race with AI makes detection increasingly difficult
- **Alternative Approaches**: Many educators pivoting to assignment redesign over detection

### Detailed Documentation
See: `/workspace/docs/research/TURNITIN_AI_DETECTION_RESEARCH.md` (comprehensive 17-section report with strong caution recommendation)

---

## Additional Reference Systems

### Other Document Review Tools Investigated
*To be populated*

### Open Source Canvas Implementations
*To be populated*

### Academic Integrity Tools
*To be populated*

---

## Research Evidence

### Artifacts Location
- Research Documents: `/workspace/docs/research/`
  - `CANVAS_DOCVIEWER_RESEARCH.md` - Complete DocViewer feature documentation
  - `CANVAS_SPEEDGRADER_RESEARCH.md` - Complete SpeedGrader feature documentation
  - `CANVAS_EVIDENCE.md` - All source links and references (65+ sources)
- Evidence Classification: OBSERVED, DOCUMENTED, INFERRED, UNAVAILABLE
- No screenshots/recordings collected (public documentation research only)

### Evidence Index

**Documentation Sources** (60+ primary sources):
- Official Instructure Canvas Community Knowledge Base (35+ articles)
- DocViewer API Documentation (6 technical pages)
- Canvas LMS GitHub Repository (3 resources)
- Canvas REST API Specifications (2 endpoints)
- University/Institution Guides (15+ resources)

**Video Demonstrations** (5 sources):
- YouTube tutorials on Canvas DocViewer and SpeedGrader
- Official Instructure video resources

**Evidence Quality**: High (majority from official Instructure documentation)

**Coverage**: Comprehensive for publicly observable features

**Evidence Document**: See `/workspace/docs/research/CANVAS_EVIDENCE.md` for complete source listing with URLs

---

## Research Methodology

### REA Investigation Process
1. Identify target application/feature
2. Set up authorized test environment
3. Execute REA analysis commands
4. Capture observable behavior
5. Document UI state transitions
6. Test edge cases and error conditions
7. Record evidence (screenshots, videos, traces)
8. Classify findings (OBSERVED/DOCUMENTED/INFERRED/UNAVAILABLE)
9. Document acceptance criteria
10. Propose implementation approach

### Ethical Boundaries
- ✅ Authorized test accounts only
- ✅ Public documentation research
- ✅ Observable UI behavior analysis
- ✅ Permitted client-side inspection
- ❌ No authentication bypass
- ❌ No access control circumvention
- ❌ No confidential data harvesting
- ❌ No proprietary model extraction
- ❌ No license violation

---

## Research Evidence

### Comprehensive Evidence Documentation
See: `/workspace/docs/research/TURNITIN_EVIDENCE.md` for complete source catalog including:
- 40+ official documentation links
- Academic research papers (9 peer-reviewed studies)
- Video demonstrations (4 official tutorials)
- Institutional guidance documents
- Interactive demos and tours
- Search queries and methodology

---

**Status**: Agent 1 Research COMPLETE | Agent 2 Research PENDING  
**Last Updated**: 2026-10-18  
**Next Action**: Integrate Canvas findings into FEATURE_PARITY_MATRIX.md; Agent 2 to conduct Turnitin research
