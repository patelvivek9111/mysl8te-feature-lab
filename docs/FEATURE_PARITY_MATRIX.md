# Feature Parity Matrix

## Purpose
Track implementation status, test evidence, and parity assessment for all reference features.

## Status Classifications
- **PASS**: Implemented and independently verified with evidence
- **PARTIAL**: Implemented but missing verified behavior
- **FAIL**: Does not satisfy acceptance criteria
- **BLOCKED**: Cannot proceed due to concrete dependency
- **NOT TESTED**: Implementation exists but lacks verification
- **NOT STARTED**: Not yet implemented

---

## Canvas DocViewer Features

| Feature | Reference Behavior | Status | Implementation | Test Evidence | Confidence | Notes |
|---------|-------------------|--------|----------------|---------------|------------|-------|
| Multi-page PDF viewing | TBD | NOT STARTED | - | - | - | Research pending |
| Zoom controls | TBD | NOT STARTED | - | - | - | Research pending |
| Rotation | TBD | NOT STARTED | - | - | - | Research pending |
| Navigation | TBD | NOT STARTED | - | - | - | Research pending |
| Search in document | TBD | NOT STARTED | - | - | - | Research pending |
| Text selection | TBD | NOT STARTED | - | - | - | Research pending |
| Highlighting | TBD | NOT STARTED | - | - | - | Research pending |
| Underlining | TBD | NOT STARTED | - | - | - | Research pending |
| Strikethrough | TBD | NOT STARTED | - | - | - | Research pending |
| Freehand drawing | TBD | NOT STARTED | - | - | - | Research pending |
| Text annotation | TBD | NOT STARTED | - | - | - | Research pending |
| Point comments | TBD | NOT STARTED | - | - | - | Research pending |
| Sticky notes | TBD | NOT STARTED | - | - | - | Research pending |
| Color selection | TBD | NOT STARTED | - | - | - | Research pending |
| Stroke options | TBD | NOT STARTED | - | - | - | Research pending |
| Annotation editing | TBD | NOT STARTED | - | - | - | Research pending |
| Move & resize | TBD | NOT STARTED | - | - | - | Research pending |
| Delete annotations | TBD | NOT STARTED | - | - | - | Research pending |
| Undo/redo | TBD | NOT STARTED | - | - | - | Research pending |
| Annotation persistence | TBD | NOT STARTED | - | - | - | Research pending |
| Accurate positioning | TBD | NOT STARTED | - | - | - | Research pending |
| Autosave | TBD | NOT STARTED | - | - | - | Research pending |
| Concurrent modifications | TBD | NOT STARTED | - | - | - | Research pending |
| Version history | TBD | NOT STARTED | - | - | - | Research pending |
| Comment threads | TBD | NOT STARTED | - | - | - | Research pending |
| Replies | TBD | NOT STARTED | - | - | - | Research pending |
| Draft feedback | TBD | NOT STARTED | - | - | - | Research pending |
| Publish feedback | TBD | NOT STARTED | - | - | - | Research pending |
| Student visibility | TBD | NOT STARTED | - | - | - | Research pending |
| Permissions | TBD | NOT STARTED | - | - | - | Research pending |
| Annotated exports | TBD | NOT STARTED | - | - | - | Research pending |
| Original downloads | TBD | NOT STARTED | - | - | - | Research pending |
| Keyboard controls | TBD | NOT STARTED | - | - | - | Research pending |
| Accessibility | TBD | NOT STARTED | - | - | - | Research pending |
| Responsive behavior | TBD | NOT STARTED | - | - | - | Research pending |
| Error recovery | TBD | NOT STARTED | - | - | - | Research pending |

---

## Canvas SpeedGrader Features

| Feature | Reference Behavior | Status | Implementation | Test Evidence | Confidence | Notes |
|---------|-------------------|--------|----------------|---------------|------------|-------|
| Submission queue | TBD | NOT STARTED | - | - | - | Research pending |
| Student navigation | TBD | NOT STARTED | - | - | - | Research pending |
| Assignment metadata | TBD | NOT STARTED | - | - | - | Research pending |
| Grade entry | TBD | NOT STARTED | - | - | - | Research pending |
| Grading rubrics | TBD | NOT STARTED | - | - | - | Research pending |
| Per-criterion feedback | TBD | NOT STARTED | - | - | - | Research pending |
| General comments | TBD | NOT STARTED | - | - | - | Research pending |
| Inline annotations | TBD | NOT STARTED | - | - | - | Research pending |
| Draft feedback | TBD | NOT STARTED | - | - | - | Research pending |
| Publish feedback | TBD | NOT STARTED | - | - | - | Research pending |
| Student replies | TBD | NOT STARTED | - | - | - | Research pending |
| Submission revisions | TBD | NOT STARTED | - | - | - | Research pending |
| Version selection | TBD | NOT STARTED | - | - | - | Research pending |
| Grading history | TBD | NOT STARTED | - | - | - | Research pending |
| Notifications | TBD | NOT STARTED | - | - | - | Research pending |
| Downloadable feedback | TBD | NOT STARTED | - | - | - | Research pending |
| Permissions | TBD | NOT STARTED | - | - | - | Research pending |
| Audit trails | TBD | NOT STARTED | - | - | - | Research pending |

---

## Turnitin Similarity Features

| Feature | Reference Behavior | Status | Implementation | Test Evidence | Confidence | Notes |
|---------|-------------------|--------|----------------|---------------|------------|-------|
| Document ingestion | Min 20 words, max 100MB/800 pages; accepts DOCX/PDF/TXT/RTF; 10 sec-15 min processing | NOT STARTED | - | - | - | DOCUMENTED |
| Text extraction | Requires selectable text (not scanned images); fingerprinting phrase extraction | NOT STARTED | - | - | - | High-level DOCUMENTED, algorithm UNAVAILABLE |
| Similarity percentage | Formula: (Matching Words / Total Words) × 100; color-coded 0-100% ranges | NOT STARTED | - | - | - | DOCUMENTED; independent algorithm required |
| Source matching | Compares against 90B+ web pages, 170M+ publications, 1.2B+ student papers | NOT STARTED | - | - | - | Database composition DOCUMENTED; matching logic UNAVAILABLE |
| Passage highlighting | Color-coded by match group (4 categories); source number overlay on text | NOT STARTED | - | - | - | DOCUMENTED |
| Source attribution | Source cards with name, URL, database type, % match, word count | NOT STARTED | - | - | - | DOCUMENTED |
| Source navigation | Click highlight→source card; arrows navigate multiple matches per source | NOT STARTED | - | - | - | DOCUMENTED |
| Quote exclusions | Checkbox filter removes quotation mark-wrapped text from score | NOT STARTED | - | - | - | DOCUMENTED |
| Bibliography exclusions | Checkbox filter removes reference sections from score | NOT STARTED | - | - | - | DOCUMENTED |
| Small-match exclusions | Word count threshold (min 8 words); percentage threshold (classic only) | NOT STARTED | - | - | - | DOCUMENTED |
| Configurable thresholds | Assignment-level settings for exclusions and repository selection | NOT STARTED | - | - | - | DOCUMENTED |
| Recalculation | Real-time recalculation when filters/exclusions applied | NOT STARTED | - | - | - | DOCUMENTED |
| Report storage | 180-day minimum retention after class end; per-report filter states saved | NOT STARTED | - | - | - | DOCUMENTED |
| Report revisions | Resubmissions: first 3 immediate, 4th+ 24hr delay; overwrites previous | NOT STARTED | - | - | - | DOCUMENTED |
| Instructor controls | Repository selection, storage options, report timing, visibility controls | NOT STARTED | - | - | - | DOCUMENTED |
| Source evidence | Expandable source cards with URL, snippet, matched text, overlapping sources | NOT STARTED | - | - | - | DOCUMENTED |
| Report export | PDF export (similarity, grading, original); bulk CSV + ZIP downloads | NOT STARTED | - | - | - | DOCUMENTED |
| Cross-submission matching | Detects student collusion; earlier submission lower score, later 100% | NOT STARTED | - | - | - | DOCUMENTED; independent implementation required |
| Match groups (4 categories) | Not Cited/Quoted, Missing Quotations, Missing Citation, Cited & Quoted | NOT STARTED | - | - | - | DOCUMENTED; ML citation detection |

---

## Turnitin AI Writing Detection Features

| Feature | Reference Behavior | Status | Implementation | Test Evidence | Confidence | Notes |
|---------|-------------------|--------|----------------|---------------|------------|-------|
| AI-generated detection | 300-30K word prose; <1% doc-level FPR (claimed); 93% human accuracy (research) | NOT STARTED | - | - | - | **CAUTION**: Model UNAVAILABLE; consider NOT building |
| AI-paraphrased detection | English only; detects Quillbot-style paraphrasers; purple highlighting | NOT STARTED | - | - | - | **CAUTION**: 60% accuracy on humanized AI (research) |
| Human writing classification | 93% accuracy (research); but bias concerns for non-native speakers | NOT STARTED | - | - | - | **BIAS RISK**: Institutional concerns documented |
| Mixed content handling | 43% hybrid accuracy (research); most challenging scenario | NOT STARTED | - | - | - | **UNRELIABLE**: Research shows poor hybrid performance |
| Confidence scoring | 0%, *% (1-19% suppressed), 20-100%; doc-level only (sentence unreliable) | NOT STARTED | - | - | - | Scoring logic UNAVAILABLE |
| Passage-level results | Cyan (AI-generated), purple (AI-paraphrased); interactive breakdown bar | NOT STARTED | - | - | - | Display DOCUMENTED; detection UNAVAILABLE |
| Report format | Integrated tab; overall %, submission breakdown, highlighted passages | NOT STARTED | - | - | - | DOCUMENTED |
| Language support | English (full), Spanish/Japanese/Arabic (AI-gen only, no paraphraser) | NOT STARTED | - | - | - | DOCUMENTED; **Limit to English** for MVP |
| Document length handling | Min 300 words qualifying prose, max 30K words | NOT STARTED | - | - | - | DOCUMENTED |
| Editing detection | Poor performance on edited/humanized AI (21% sensitivity - research) | NOT STARTED | - | - | - | **KNOWN LIMITATION**: Modified AI evades detection |
| Report settings | Separate from similarity; PDF export; licensed feature | NOT STARTED | - | - | - | DOCUMENTED |
| Bypasser detection | English only; detects "humanizer" tools; cyan highlighting | NOT STARTED | - | - | - | Detection method UNAVAILABLE |

**⚠️ STRONG RECOMMENDATION**: Consider NOT implementing AI detection due to:
- Proprietary model unavailable (cannot replicate)
- False positive concerns (legal/ethical liability)
- Bias concerns (non-native speakers, neurodivergent students)
- Research shows poor accuracy for edited/hybrid/paraphrased AI
- Major institutions (Vanderbilt) disabling feature
- Arms race with evolving AI models
- Alternative: Focus on similarity detection + assignment redesign guidance

---

## Universal Document Support

**Turnitin Reference Support**: ✅ DOCX, ✅ DOC, ✅ PDF (text), ✅ RTF, ✅ TXT, ✅ ODT, ✅ PPTX, ✅ PPT, ✅ HTML, ❌ DOCM, ❌ image PDF, ❌ scanned PDF

| Format | Upload | Preview | Extract | Annotate | Search | Similarity | AI Detection | Export | Status | Turnitin Notes |
|--------|--------|---------|---------|----------|--------|------------|--------------|--------|--------|----------------|
| PDF | - | - | - | - | - | ✅ Yes | ✅ Yes | - | NOT STARTED | Must be text-based, not scanned/image |
| DOCX | - | - | - | - | - | ✅ Yes | ✅ Yes | - | NOT STARTED | Fully supported |
| DOC | - | - | - | - | - | ✅ Yes | ✅ Yes | - | NOT STARTED | Word 97-2003 supported |
| DOCM | - | - | - | - | - | ❌ No | ❌ No | - | NOT STARTED | Macro-enabled rejected |
| RTF | - | - | - | - | - | ✅ Yes | ✅ Yes | - | NOT STARTED | Fully supported |
| ODT | - | - | - | - | - | ✅ Yes | ⚠️ Partial | - | NOT STARTED | Not from Google Docs |
| TXT | - | - | - | - | - | ✅ Yes | ✅ Yes | - | NOT STARTED | Plain text supported |
| Markdown | - | - | - | - | - | ⚠️ Via HTML | ⚠️ Via HTML | - | NOT STARTED | Not direct format |
| XLSX | - | - | - | - | - | ✅ Yes | ❌ N/A | - | NOT STARTED | Supported but limited prose |
| XLS | - | - | - | - | - | ✅ Yes | ❌ N/A | - | NOT STARTED | Supported but limited prose |
| ODS | - | - | - | - | - | ❌ No | ❌ No | - | NOT STARTED | Not supported |
| CSV | - | - | - | - | - | ❌ No | ❌ N/A | - | NOT STARTED | Not mentioned |
| PPTX | - | - | - | - | - | ✅ Yes | ⚠️ Partial | - | NOT STARTED | No visual effects; each slide=page |
| PPT | - | - | - | - | - | ✅ Yes | ⚠️ Partial | - | NOT STARTED | No visual effects; "Slate" theme issue |
| ODP | - | - | - | - | - | ❌ No | ❌ No | - | NOT STARTED | Not supported |
| PNG/JPG/WEBP | - | - | OCR | - | - | ❌ No | ❌ N/A | - | NOT STARTED | Not supported by Turnitin |
| Python/JS/etc | - | - | - | - | - | ⚠️ TXT | ❌ N/A | - | NOT STARTED | Code not "qualifying text" for AI |
| ZIP/TAR | - | N/A | Extract | - | - | ⚠️ Contents | ⚠️ Contents | - | NOT STARTED | Extracts contents (max 1000 files) |

**Legend**: ✅ Fully Supported | ⚠️ Partial/Conditional | ❌ Not Supported | N/A Not Applicable

---

## Overall Parity Summary

### Canvas DocViewer
- **Total Features**: 35
- **Status**: 0 PASS, 0 PARTIAL, 0 FAIL, 0 BLOCKED, 0 NOT TESTED, 35 NOT STARTED
- **Overall Parity**: 0%
- **Research Status**: ⏳ PENDING (Agent 1)

### Canvas SpeedGrader
- **Total Features**: 18
- **Status**: 0 PASS, 0 PARTIAL, 0 FAIL, 0 BLOCKED, 0 NOT TESTED, 18 NOT STARTED
- **Overall Parity**: 0%
- **Research Status**: ⏳ PENDING (Agent 1)

### Turnitin Similarity
- **Total Features**: 19 (updated count)
- **Status**: 0 PASS, 0 PARTIAL, 0 FAIL, 0 BLOCKED, 0 NOT TESTED, 19 NOT STARTED
- **Overall Parity**: 0%
- **Research Status**: ✅ COMPLETE (Agent 2, 2026-10-18)
- **Reference Behaviors**: DOCUMENTED for all features
- **Implementation Note**: Independent algorithm required (proprietary unavailable)

### Turnitin AI Detection
- **Total Features**: 12 (updated count)
- **Status**: 0 PASS, 0 PARTIAL, 0 FAIL, 0 BLOCKED, 0 NOT TESTED, 12 NOT STARTED
- **Overall Parity**: 0%
- **Research Status**: ✅ COMPLETE (Agent 2, 2026-10-18)
- **Reference Behaviors**: DOCUMENTED for all features
- **Implementation Recommendation**: ⚠️ **CONSIDER NOT BUILDING** due to:
  - Proprietary model unavailable
  - Significant accuracy limitations (43% hybrid, 60% humanized AI)
  - False positive concerns and bias risks
  - Major universities disabling feature
  - Ethical/legal liability concerns

### Document Formats
- **Total Formats**: 19 (Turnitin-relevant)
- **Turnitin Support Documented**: 11 fully supported, 4 partial, 4 rejected
- **Status**: 0 implemented, 19 not started
- **Overall Coverage**: 0%
- **Research Status**: ✅ COMPLETE for Turnitin reference (Agent 2)

---

## Implementation Priority Recommendations

**Based on Research Findings**:

### Phase 1: Core Similarity Detection (HIGH PRIORITY)
- Document processing (PDF, DOCX, TXT, RTF)
- Text extraction and fingerprinting
- Similarity percentage calculation
- Passage highlighting
- Source attribution
- Basic exclusions (quotes, bibliography, small matches)

### Phase 2: Enhanced Similarity Features (MEDIUM PRIORITY)
- Match groups with citation detection
- Advanced exclusions and filters
- Report export (PDF)
- Cross-submission detection
- Repository management

### Phase 3: Canvas Integration (HIGH PRIORITY)
- DocViewer research and implementation (Agent 1)
- SpeedGrader research and implementation (Agent 1)
- Annotation and feedback tools

### Phase 4: AI Detection (LOW PRIORITY / OPTIONAL)
- **⚠️ CAUTION**: Extensive research required before proceeding
- Consider alternative: Assignment design guidance instead
- If building: Independent model development and rigorous validation
- Must document limitations, biases, and accuracy metrics
- Never position as definitive proof of AI use

---

## Update Log

### 2026-10-18 - Initial Template
- Created feature matrix template
- Defined status classifications
- Identified features for tracking
- Awaiting research phase to populate reference behaviors

---

**Last Updated**: 2026-10-18  
**Status**: Template - Awaiting Research Data  
**Next Action**: Populate reference behaviors from Agent 1 & Agent 2 research
