# Agent 2 Research Completion Report

**Date**: 2026-10-18  
**Agent**: Agent 2 - Turnitin Reverse Engineering Specialist  
**Status**: ✅ COMPLETE

---

## Executive Summary

Agent 2 has completed comprehensive research on Turnitin's Similarity Detection and AI Writing Detection features through systematic review of official documentation, academic research papers, institutional policies, and demonstration videos. The research identified observable behaviors, proprietary limitations, and critical considerations for independent implementation.

---

## Research Methodology

**Approach**:
- Web searches for official Turnitin documentation
- Review of academic peer-reviewed research papers
- Analysis of university institutional policies
- Video demonstration reviews
- Evidence classification: DOCUMENTED, INFERRED, UNAVAILABLE

**Sources Reviewed**: 40+ unique sources including:
- 14 official Turnitin/iThenticate guides
- 5 Turnitin blog posts
- 9 peer-reviewed academic research papers
- 4 official video demonstrations
- 3+ institutional policy documents

---

## Key Findings: Turnitin Similarity Detection

### Observable Behavior (DOCUMENTED)

**Core Functionality**:
- **Formula**: Similarity % = (Matching Words / Total Words) × 100
- **Processing**: 10 seconds to 15 minutes typical (20 reports/sec system-wide)
- **File Requirements**: Min 20 words, max 100MB/800 pages
- **Supported Formats**: DOCX, DOC, PDF (text-based), RTF, TXT, HTML, ODT, PPTX, PPT

**Match Groups** (4 categories):
1. Not Cited or Quoted - highest concern
2. Missing Quotations - has citation, needs quotes
3. Missing Citation - has quotes, needs citation
4. Cited and Quoted - properly attributed

**Citation Detection**:
- Machine learning model trained on APA, MLA, Turabian, IEEE
- English content only currently
- Recognizes multiple quotation mark styles

**Source Database** (DOCUMENTED):
- 90+ billion web pages (current and archived)
- 170+ million academic articles
- 1.2+ billion previously submitted student papers
- Crossref content (published and posted scholarly works)

**Exclusion Controls**:
- Quote exclusions (checkbox)
- Bibliography exclusions (checkbox)
- Cited text exclusions (checkbox)
- Small match exclusions (min 8 words threshold)
- Manual match/source exclusions

**Source Prioritization**:
When identical text in multiple sources: Internet > Publications > Submitted Works

**Export Formats**:
- PDF (Similarity Report, Grading Report, Original File)
- Bulk CSV + ZIP downloads available

### Proprietary Components (UNAVAILABLE)

**Cannot Be Replicated**:
1. Exact fingerprinting algorithm (phrase extraction, ID generation, comparison heuristics)
2. Natural language processing false-positive reduction techniques
3. Source corpus composition and publisher partnerships
4. Match weighting and prioritization logic beyond documented priority order
5. Server-side infrastructure and optimization methods

### Academic Research Findings (DOCUMENTED)

**Efficacy Studies**:
- 82.4% detection rate for verbatim plagiarism (2009)
- 16.8% combined false-positive rate
- Effective for exact copying, inconsistent for paraphrasing
- Cannot detect semantic plagiarism (ideas without language)
- Common references and technical phrases frequently flagged
- Deterrent effect proven when students aware of use

**Official Disclaimers** (Turnitin's own):
- "Turnitin does NOT check for plagiarism" - only text similarity
- "There is NO acceptable similarity score" - context-dependent
- "Close review of suspected material is essential" - human judgment required

---

## Key Findings: Turnitin AI Writing Detection

### ⚠️ CRITICAL RECOMMENDATION

**CONSIDER NOT IMPLEMENTING AI DETECTION** due to:
1. Significant accuracy limitations (43% hybrid, 60% humanized AI)
2. Bias concerns (non-native speakers, neurodivergent students flagged disproportionately)
3. False positive legal/ethical liability
4. Major universities (Vanderbilt) disabling feature
5. Proprietary model cannot be replicated
6. Arms race with evolving AI models (GPT-5+ evades better)

### Observable Behavior (DOCUMENTED)

**Core Functionality**:
- Paid add-on feature (license required)
- Min 300 words prose, max 30,000 words
- Supported formats: DOCX, PDF, TXT, RTF
- Languages: English (full), Spanish/Japanese/Arabic (AI-gen only, no paraphraser detection)

**Detection Categories** (English only):
1. AI-generated only (cyan highlighting) - LLM output
2. AI-generated + paraphrased (purple highlighting) - Modified by paraphraser (e.g., Quillbot)

**Confidence Scoring**:
- 0%: No AI detected
- 1-19%: Displayed as `*%` (suppressed due to high false positive rate)
- 20-100%: Numeric percentage displayed
- Sentence-level highlights: Unreliable (4% FPR)

**Official Disclaimers** (Turnitin's own):
> "May not always be accurate (may misidentify human-written, AI-generated, and AI-paraphrased text)"
> "Should NOT be used as the sole basis for adverse actions against a student"
> "Requires further scrutiny and human judgment"

### Academic Research Findings (DOCUMENTED)

**Temple University Study (2024)**:
- 93% human accuracy (7% false positives)
- 77% AI-generated accuracy (23% false negatives)
- 63% disguised AI accuracy (37% false negatives)
- **43% hybrid content accuracy** (57% misclassified) - MOST CHALLENGING

**Robustness Study (2024)**:
- **60% accuracy for humanized AI** (near random guessing)
- 21% sensitivity/recall (79% false negatives)
- 34% F1 score (poor overall performance)

**O-1 Model Study (2025)**:
- GPT-5 text more likely misclassified as human than GPT-4o
- Newer AI models evade detection better (arms race)

**Institutional Responses**:
- **Vanderbilt University**: Disabled Turnitin AI detector entirely (2023)
- **University of Melbourne**: Requires second evidence piece, never AI score alone
- Multiple institutions report bias concerns

### Proprietary Components (UNAVAILABLE)

**Cannot Be Replicated**:
1. Model architecture (neural network design, size, training methodology)
2. Training data composition (sources, volume, AI model versions, demographics)
3. Confidence calibration (percentage calculation method)
4. Paraphraser detection methodology (Quillbot-style detection)
5. Bypasser/humanizer detection methodology
6. Feature engineering and detection patterns

---

## Implementation Recommendations

### Similarity Detection: PROCEED WITH CAUTION

**Feasible to Build**:
- Independent text matching algorithm (n-grams, Winnowing, etc.)
- Document processing pipeline
- Passage highlighting and source attribution
- Exclusion controls
- Report generation and export

**Critical Differences from Turnitin**:
- Smaller source corpus (start with 1M docs vs Turnitin's 90B+)
- Different matching algorithm (different results expected)
- Different false positive/negative rates
- No global student repository (privacy-focused)

**Required Disclosures**:
1. Not official Turnitin (independent implementation)
2. Different algorithm and source database
3. Results will differ from Turnitin
4. Similarity ≠ plagiarism (human review required)
5. Known limitations documented
6. Measured accuracy metrics published

### AI Detection: STRONG CAUTION OR DON'T BUILD

**Why Extreme Caution**:
1. Research shows poor hybrid (43%) and humanized AI (60%) accuracy
2. Bias risks for vulnerable student populations
3. False accusation legal/ethical liability
4. No way to replicate Turnitin's proprietary model
5. Continuous arms race with evolving AI (unsustainable)
6. Major institutions disabling or restricting use

**Alternative Approach** (Recommended):
- Focus on assignment redesign guidance
- Process-based assessment strategies
- AI literacy education resources
- No detection tool = no false accusation liability

**If Proceeding Despite Caution**:
- Use existing open models (GPTZero API) or train custom model
- Extensive evaluation on diverse datasets required
- Measure and document FPR, FNR, bias across demographics
- Conservative thresholds (30%+ to reduce false positives)
- Extensive disclosure requirements (10+ critical disclosures)
- Never position as proof, only screening tool
- Must combine with additional evidence

---

## Documentation Delivered

### Primary Research Documents

1. **TURNITIN_SIMILARITY_RESEARCH.md** (19 sections)
   - Comprehensive 19-section analysis
   - Observable behaviors documented
   - Proprietary components identified
   - Implementation approaches proposed
   - Evaluation methodology defined

2. **TURNITIN_AI_DETECTION_RESEARCH.md** (17 sections)
   - Comprehensive 17-section analysis
   - Accuracy limitations extensively documented
   - Bias concerns detailed
   - Strong caution recommendation
   - Ethical considerations enumerated

3. **TURNITIN_EVIDENCE.md**
   - 40+ source catalog
   - Official documentation links
   - Academic research papers
   - Video demonstrations
   - Institutional policies
   - Search methodology documented

### Updated Documentation

4. **RESEARCH_INVENTORY.md**
   - Turnitin Similarity section: Complete with key findings
   - Turnitin AI Detection section: Complete with caution notes
   - Evidence documentation added

5. **FEATURE_PARITY_MATRIX.md**
   - 19 Turnitin Similarity features documented with reference behaviors
   - 12 Turnitin AI Detection features documented with caution notes
   - Document format support matrix updated
   - Implementation priority recommendations added

6. **KNOWN_LIMITATIONS.md**
   - Comprehensive Similarity Detection limitations section
   - Extensive AI Detection limitations section (with strong recommendation not to build)
   - Disclosure requirements (10+ critical disclosures for AI detection)
   - Ethical constraints documented
   - Alternative approaches proposed

7. **MISSION_STATUS.md**
   - Agent 2 status updated to COMPLETE
   - Research targets checked off
   - Key findings summary added

---

## Critical Insights

### What We CAN Build

**Similarity Detection** (Feasible):
- Text-based similarity matching with independent algorithm
- Document processing for common formats
- Passage highlighting with source attribution
- Exclusion controls (quotes, bibliography, small matches)
- Report generation and export
- Will have different results than Turnitin (must disclose)

### What We CANNOT Build

**Exact Turnitin Replication** (Impossible):
- Cannot replicate proprietary fingerprinting algorithm
- Cannot access Turnitin's 90B+ page corpus
- Cannot achieve identical match results
- Cannot claim equivalent accuracy without independent validation

**Reliable AI Detection** (Not Recommended):
- Research shows 43-60% accuracy for challenging cases
- Bias risks well-documented
- False positive liability significant
- Proprietary model unavailable
- Arms race with AI unsustainable
- Major universities disabling feature

### What We MUST Disclose

**For Similarity Detection**:
1. Independent system, not Turnitin
2. Different algorithm and source corpus
3. Results will differ
4. Similarity ≠ plagiarism
5. Human review required
6. Documented limitations

**For AI Detection** (If Built Despite Caution):
1. Independent system, not Turnitin
2. Different model and accuracy profile
3. Probabilistic screening, never proof
4. False positive/negative rates documented
5. Known biases disclosed
6. Never sole evidence for misconduct
7. No automatic actions permitted
8. Student rights and appeals process
9. Alternative resources provided
10. Comparison to research findings

---

## Next Steps

### Immediate (Milestone A)
1. ✅ Research complete for Turnitin components
2. ⏳ Await Agent 1 Canvas research completion
3. ⏳ Architecture refinement based on all research findings
4. ⏳ Technology stack selection
5. ⏳ Implementation roadmap finalization

### Future Milestones (B-H)
- **Milestone B**: Universal Document Processing
- **Milestone C**: DocViewer & Annotation System
- **Milestone D**: SpeedGrader & Feedback
- **Milestone E**: Similarity Detection (if proceeding)
- **Milestone F**: AI Writing Analysis (if proceeding - NOT RECOMMENDED)
- **Milestone G**: Full-System Integration
- **Milestone H**: Hardening & Final Acceptance

### Critical Decision Point

**AI Detection Feature**:
- **Recommendation**: DO NOT BUILD
- **Rationale**: Research shows poor accuracy, bias risks, liability concerns, unsustainable arms race
- **Alternative**: Provide assignment redesign and AI literacy resources
- **If Proceeding**: Requires executive decision with full understanding of limitations and risks

---

## Research Quality Assessment

### Strengths
- ✅ Comprehensive source coverage (40+ authoritative sources)
- ✅ Multiple evidence types (official docs, academic research, institutional policies)
- ✅ Clear classification (DOCUMENTED, INFERRED, UNAVAILABLE)
- ✅ Honest assessment of limitations
- ✅ Practical implementation guidance
- ✅ Ethical considerations prioritized

### Limitations
- ⚠️ No hands-on REA testing (documentation review only)
- ⚠️ No direct Turnitin account access
- ⚠️ Cannot verify proprietary algorithm details
- ⚠️ Some features inferred from descriptions vs. observed

### Confidence Level
- **HIGH**: Observable behaviors, UI features, file requirements, official disclaimers
- **MEDIUM**: Internal algorithm behavior (inferred from descriptions)
- **LOW/UNAVAILABLE**: Exact algorithms, training data, proprietary techniques

---

## Conclusion

Agent 2 has successfully completed comprehensive research on Turnitin Similarity Detection and AI Writing Detection features. The research provides a solid foundation for:

1. **Similarity Detection**: Feasible independent implementation with clear understanding of observable behaviors, limitations, and disclosure requirements

2. **AI Detection**: Strong recommendation NOT to build due to accuracy limitations, bias concerns, liability risks, and institutional hesitation

The research is well-documented with 40+ authoritative sources, clear evidence classification, and honest assessment of what can and cannot be replicated. All documentation has been updated to reflect findings.

**Status**: ✅ RESEARCH COMPLETE - Ready for Architecture Refinement

---

**Research Completed**: 2026-10-18  
**Total Sources**: 40+ (14 official docs, 9 academic papers, 4 videos, 3+ policies)  
**Pages Documented**: 100+ pages of comprehensive research  
**Key Recommendation**: Proceed with Similarity Detection, DO NOT build AI Detection
