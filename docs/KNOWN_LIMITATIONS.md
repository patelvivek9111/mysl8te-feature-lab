# Known Limitations

## Purpose
Document explicit system limitations, reference feature gaps, and acceptable deviations from reference products.

---

## Architecture & Design Limitations

### Standalone System
- **Limitation**: Not integrated with existing MySL8TE application
- **Reason**: Mission requirement for isolated development
- **Impact**: Requires separate authentication, data storage, and deployment
- **Future**: Integration contracts documented for future MySL8TE incorporation

### Authentication
- **Status**: TBD
- **Planned Approach**: Independent auth system with teacher/student roles
- **Missing**: LTI integration, institution SSO, Canvas/Turnitin account linking
- **Future**: Integration design documented but not implemented

---

## Reference Feature Gaps

### Canvas DocViewer

#### Currently Known Unavailable Features
*To be populated after Agent 1 research*

#### Intentionally Omitted Features
*To be documented*

#### Different Implementation Approach
*To be documented*

### Canvas SpeedGrader

#### Currently Known Unavailable Features
*To be populated after Agent 1 research*

#### Intentionally Omitted Features
*To be documented*

### Turnitin Similarity Detection

#### Research Status: ✅ COMPLETE (2026-10-18, Agent 2)

#### Proprietary Components (UNAVAILABLE)
1. **Fingerprinting Algorithm**: Turnitin's exact phrase fingerprinting algorithm is proprietary
   - **What We Know**: High-level description (break into phrases, assign IDs, remove common words)
   - **What's Missing**: Exact phrase selection, ID generation, comparison heuristics
   - **Our Approach**: Independent n-gram matching, Winnowing algorithm, or similar open-source technique
   - **Difference**: Will produce different match granularity and potentially different match boundaries
   - **Validation**: Test on known plagiarism datasets, measure precision/recall

2. **Source Corpus**: Turnitin's 90B+ web pages, 170M+ publications, 1.2B+ student papers inaccessible
   - **What We Know**: Database categories and approximate sizes
   - **What's Missing**: Actual content, publisher partnerships, update frequency
   - **Our Approach**: Build independent corpus from open web crawl, open-access publications, opt-in student submissions
   - **Difference**: Significantly smaller corpus, different source coverage
   - **Impact**: May find different sources, miss some matches Turnitin would catch
   - **Scale Estimate**: Start with 1M documents, grow to 10M+ over time (vs Turnitin's 90B+)

3. **Natural Language Processing Heuristics**: False positive reduction techniques are proprietary
   - **What We Know**: NLP applied to reduce false positives
   - **What's Missing**: Exact techniques, thresholds, weighting
   - **Our Approach**: Standard NLP techniques (stopword filtering, phrase boundary detection, context analysis)
   - **Difference**: Different false positive rates
   - **Validation**: Measure FPR on test datasets with known legitimate citations

4. **Scoring Formula**: Exact similarity percentage calculation may include weighting
   - **What We Know**: Basic formula is (Matching Words / Total Words) × 100
   - **What's Missing**: Any internal weighting, normalization, or adjustments
   - **Our Approach**: Simple word-count ratio as documented
   - **Difference**: Percentages may differ slightly if Turnitin uses weighting
   - **Disclosure**: Document our exact formula transparently

5. **Match Prioritization**: How overlapping sources are ranked is partially proprietary
   - **What We Know**: Priority order (Internet > Publications > Student Papers)
   - **What's Missing**: Tie-breaking rules, recency weighting, authority scoring
   - **Our Approach**: Follow documented priority order, add recency as tie-breaker
   - **Difference**: May show different "top source" for same text

#### Technical Limitations We Will Face

1. **Processing Speed**: Turnitin processes in 10 seconds (20 reports/sec system-wide)
   - **Our Reality**: Initial implementation will be slower without massive infrastructure
   - **Mitigation**: Async processing, progress indicators, realistic expectations

2. **Scale**: Turnitin handles 1M+ submissions/day at peak
   - **Our Reality**: Start with much smaller scale
   - **Mitigation**: Design for scalability, but launch at smaller scale

3. **Citation Detection ML**: Turnitin uses ML trained on APA, MLA, Turabian, IEEE
   - **Our Reality**: May need rule-based citation detection initially
   - **Mitigation**: Implement regex patterns for common formats, add ML later

4. **False Positive Rate**: Turnitin achieves 16.8% combined FPR (2009 research)
   - **Our Reality**: May have higher FPR initially
   - **Mitigation**: Tune thresholds, refine algorithms, measure and document our actual FPR

#### Intentionally Different Features

1. **No Global Repository**: We won't store all submissions in global database
   - **Reason**: Privacy concerns, storage costs
   - **Approach**: Institution-only or per-course repositories with opt-in
   - **Impact**: Won't detect cross-institution collusion

2. **Transparent Algorithm**: We will document our matching algorithm
   - **Reason**: Open-source ethos, user trust, academic transparency
   - **Approach**: Publish algorithm details in documentation
   - **Impact**: Users understand how it works (positive difference)

3. **Configurable Scoring**: Allow institutions to customize match scoring
   - **Reason**: Different fields have different needs
   - **Approach**: Expose tuning parameters
   - **Impact**: More flexible than Turnitin's fixed algorithm

#### Academic Research Findings on Turnitin Limitations

From peer-reviewed studies:
1. **Verbatim Detection**: 82.4% effective (good)
2. **Paraphrase Detection**: Inconsistent and unreliable
3. **Semantic Plagiarism**: Cannot detect (ideas copied without language)
4. **Subscription Content**: Misses content from journals without Turnitin partnerships
5. **Older Content**: Less likely to detect older articles
6. **Coincidental Matches**: Frequently flags common references and technical phrases
7. **Deterrent Effect**: Proven when students know it's being used
8. **Teaching Value**: More valuable as teaching tool than enforcement tool

### Turnitin AI Writing Detection

#### Research Status: ✅ COMPLETE (2026-10-18, Agent 2)

#### ⚠️ STRONG RECOMMENDATION: CONSIDER NOT IMPLEMENTING AI DETECTION

**Reasons**:
1. Significant accuracy limitations (43% hybrid, 60% humanized AI)
2. Bias concerns (non-native speakers, neurodivergent students)
3. False positive legal/ethical liability
4. Major universities (Vanderbilt) disabling feature
5. Proprietary model cannot be replicated
6. Arms race with evolving AI models (newer models evade better)
7. Alternative approach: Focus on assignment redesign guidance

**If We Proceed Despite Caution**:

#### Proprietary Components (UNAVAILABLE)
1. **Detection Model Architecture**: Turnitin's neural network is proprietary
   - **What We Know**: Uses ML, likely transformer-based, trained on human and AI text
   - **What's Missing**: Exact architecture, model size, training methodology
   - **Our Approach**: Use GPTZero API, train custom classifier, or use Hugging Face models
   - **Difference**: Completely different accuracy profile
   - **Validation**: MUST measure our own FPR/FNR independently; cannot claim equivalence

2. **Training Data**: Turnitin's corpus is confidential
   - **What We Know**: Trained on English content, includes AI-generated and human samples
   - **What's Missing**: Volume, sources, AI model versions, demographic diversity
   - **Our Approach**: Collect diverse dataset (human essays, GPT-3.5/4/4o/Claude outputs, edited samples)
   - **Difference**: Different bias profile, different model-specific detection rates
   - **Impact**: May detect some AI models better/worse than Turnitin

3. **Confidence Calibration**: Percentage calculation method is proprietary
   - **What We Know**: 0%, *% (suppressed 1-19%), 20-100%; sentence-level unreliable (4% FPR)
   - **What's Missing**: How percentage calculated, weighting, threshold selection
   - **Our Approach**: Document-level scoring with calibrated probability output
   - **Difference**: Scores not comparable to Turnitin percentages
   - **Transparency**: Document our calibration methodology

4. **Paraphraser Detection**: How Quillbot-style detection works is proprietary
   - **What We Know**: English only, detects AI paraphrasing tools
   - **What's Missing**: Features used, detection patterns
   - **Our Approach**: May not implement paraphraser detection initially (too complex)
   - **Impact**: Will miss paraphrased AI that Turnitin catches

5. **Bypasser/Humanizer Detection**: How "humanizer" tool detection works is proprietary
   - **What We Know**: English only, detects AI humanization attempts
   - **What's Missing**: Methodology, features
   - **Our Approach**: Likely will NOT implement (insufficient research basis)
   - **Impact**: Humanized AI will evade our detector

#### Documented Performance Limitations (From Academic Research)

**Temple University Study (2024)**:
- **Human Accuracy**: 93% (7% false positives)
- **AI-Generated Accuracy**: 77% (23% false negatives)
- **Disguised AI Accuracy**: 63% (37% false negatives)
- **Hybrid Content Accuracy**: Only 43% (57% misclassified)
- **Key Finding**: "Least effective in identifying hybrid texts"

**Robustness Study (2024)**:
- **Humanized AI Accuracy**: 60% (near random)
- **Sensitivity/Recall**: 21% (79% false negatives)
- **F1 Score**: 34% (poor overall performance)
- **Key Finding**: "Detection accuracy declined significantly for humanized text"

**O-1 Model Study (2025)**:
- **False Positive Rate**: 1% (consistent with Turnitin claim)
- **False Negative Rate**: Increases with newer AI models
- **Key Finding**: "GPT-5 more likely to be misclassified as human than GPT-4o"

**Our Expected Performance** (Honest Projection):
- **Best Case**: Similar to research findings (60-93% depending on scenario)
- **Worst Case**: Lower accuracy than Turnitin due to different training
- **Realistic**: 70-85% overall accuracy with significant gaps in edge cases
- **Must Measure**: Cannot launch without comprehensive evaluation

#### Known Bias Risks (DOCUMENTED)

**Institutional Concerns**:
1. **Non-Native English Speakers**: Flagged at higher rates (multiple universities report)
2. **Neurodivergent Students**: AI detectors flag atypical writing patterns
3. **Formulaic Writing**: Assessment-specific language triggers false positives
4. **Technical Writing**: STEM fields with standardized terminology flagged more

**University of Melbourne Guidance**:
- Only focus on >20% scores (below threshold unreliable)
- Second evidence piece required (never AI score alone)
- Consider student's typical expression style
- Be aware of formulaic writing requirements

**Vanderbilt University Action**:
- **DISABLED** Turnitin AI detector entirely in 2023
- Cited reasons: false positives (750 potential mislabels), bias concerns, lack of transparency

**Our Mitigation If We Build**:
- Test extensively on diverse populations
- Measure bias across demographics
- Document known bias patterns
- Provide clear guidance to educators
- Never use as sole evidence
- Build appeals process

#### Technical Limitations We Will Face

1. **File Requirements**:
   - Min 300 words of prose (short texts unreliable)
   - Max 30,000 words
   - Only works on "qualifying text" (not code, poetry, tables, bullets)
   - **Impact**: Limited applicability to many assignment types

2. **Language Support**:
   - English: Full support (AI-gen + paraphrasing + bypasser)
   - Other languages: Limited or no support initially
   - **Impact**: English-only MVP realistic; other languages require separate models

3. **Evolving AI Models**:
   - Newer models (GPT-5+) evade detection better
   - Arms race: AI improves faster than detectors
   - **Impact**: Continuous retraining required, never "finished"

4. **Processing Time**:
   - ML inference slower than similarity matching
   - Large documents take longer
   - **Impact**: Need async processing, can't be real-time

5. **Computational Cost**:
   - Running ML models expensive (GPU required for reasonable speed)
   - Third-party API costs per document
   - **Impact**: Higher operational costs than similarity detection

#### Ethical Constraints (CRITICAL)

1. **Not Proof of Authorship**: AI detection is probabilistic, NEVER definitive
   - **Must Disclose**: Screening tool only, not evidence
   - **Usage Policy**: Cannot be sole basis for misconduct allegation

2. **Manual Review Required**: Results must inform human judgment, not replace it
   - **Must Disclose**: Educator must review, discuss with student, gather additional evidence
   - **Usage Policy**: Student has right to explain process, show drafts

3. **False Accusation Liability**: Incorrectly accusing student of AI use has legal/ethical consequences
   - **Must Disclose**: False positive rate clearly stated
   - **Risk Mitigation**: Strong appeals process, burden of proof on institution

4. **Transparency**: Users must know this is NOT Turnitin
   - **Must Disclose**: Different model, different accuracy, different limitations
   - **Cannot Claim**: "Turnitin-equivalent" or "same accuracy as Turnitin"

5. **No Automatic Penalties**: Detection results alone cannot trigger automated actions
   - **Must Disclose**: Requires investigation and due process
   - **Technical Safeguard**: No auto-fail, auto-report, or auto-penalty features

6. **Bias Disclosure**: Known biases must be documented and disclosed
   - **Must Disclose**: Higher false positive risk for certain populations
   - **Educator Guidance**: How to account for bias in interpretation

#### Intentionally Different Features (If We Build)

1. **Full Transparency**: Document model, training data, accuracy metrics
   - **Reason**: Build trust, enable informed use
   - **Difference**: Turnitin provides minimal detail

2. **Bias Testing**: Test and publish bias metrics across demographics
   - **Reason**: Ethical obligation to understand impact
   - **Difference**: Turnitin does not publish bias data

3. **Conservative Thresholds**: Set higher threshold for flagging (e.g., 30% instead of 20%)
   - **Reason**: Reduce false positives, prioritize student protection
   - **Difference**: Fewer flags, but more reliable

4. **Educational Resources**: Provide assignment redesign guidance
   - **Reason**: Shift from detection to prevention
   - **Difference**: Focus on teaching, not policing

5. **No Bypasser Detection**: Omit humanizer detection initially
   - **Reason**: Insufficient evidence we can do it reliably
   - **Difference**: More honest about limitations

#### Alternative Approach: Do Not Build AI Detection

**Instead, Provide**:
1. **Assignment Redesign Guidance**: Help educators create AI-resistant assignments
2. **Process-Focused Assessment**: Emphasize drafts, peer review, in-class components
3. **Oral Examinations**: Assess understanding beyond written text
4. **Authentic Tasks**: Real-world projects where AI use is tool, not cheating
5. **AI Literacy Education**: Teach appropriate AI tool use

**Benefits**:
- Avoid ethical/legal risks
- No bias concerns
- No false positive liability
- Focus on pedagogy over policing
- More sustainable long-term (no arms race)

**Recommendation**: Strongly consider this alternative

---

## Document Format Limitations

### To Be Documented
After format implementation, document:
- Formats with degraded support
- Conversion quality issues
- Unsupported format features
- Performance constraints per format

---

## Performance Limitations

### To Be Documented
After performance testing, document:
- Maximum file sizes
- Processing time constraints
- Concurrent user limits
- Database size limits
- Resource requirements

---

## Security & Privacy Limitations

### To Be Documented
After security review, document:
- Known vulnerabilities (if any acceptable ones)
- Privacy limitations
- Data retention policies
- Access control constraints

---

## Browser & Platform Limitations

### To Be Documented
After cross-browser testing, document:
- Browser compatibility
- Mobile support limitations
- Accessibility gaps
- Performance differences across platforms

---

## Integration Limitations

### MySL8TE Integration (Intentional)
- **Status**: Not implemented per mission requirements
- **Documented**: Integration contracts defined but not executed
- **Reason**: Standalone development and testing required first
- **Future**: Integration plan documented for future work

### Third-Party Service Limitations
*To be documented*

Example potential limitations:
- OCR service accuracy
- AI detection service availability
- Document conversion service fidelity

---

## Scalability Limitations

### To Be Documented
After load testing, document:
- Maximum concurrent users
- Document processing throughput
- Database scaling constraints
- Infrastructure requirements

---

## Known Bugs & Technical Debt

### Critical Issues
*None currently - system not yet built*

### High Priority Issues
*To be documented*

### Medium Priority Issues
*To be documented*

### Low Priority Issues
*To be documented*

### Technical Debt
*To be documented*

---

## Future Enhancements Not In Scope

### Explicitly Out of Current Scope
1. **LTI Integration**: Canvas LTI tool integration
2. **Institution SSO**: SAML/OAuth integration with university systems
3. **Mobile Apps**: Native iOS/Android applications
4. **Real-time Collaboration**: Multiple instructors grading simultaneously
5. **Video Annotation**: Beyond timestamp comments
6. **Advanced Analytics**: Detailed usage and performance analytics
7. **API for Third-Party Integrations**: Public API for external tools
8. **Multi-language UI**: Interface localization beyond English

*These may be considered for future phases*

---

## Comparison with Reference Products

### Canvas DocViewer vs. Our Implementation
*To be populated after implementation*

### Canvas SpeedGrader vs. Our Implementation
*To be populated after implementation*

### Turnitin Similarity vs. Our Implementation
*To be populated after implementation*

**Expected Key Differences**:
- Different source corpus
- Independent matching algorithm
- Different percentage calculations
- No Turnitin branding or API access

### Turnitin AI Detection vs. Our Implementation
*To be populated after implementation*

**Expected Key Differences**:
- Independent detection model
- Different accuracy characteristics
- Different confidence scoring
- No Turnitin API access
- Must disclose it's not official Turnitin technology

---

## Disclosure Requirements

### Research-Based Disclosure Requirements

**Based on Turnitin Research (2026-10-18)**:

### For End Users - Similarity Detection
When deploying this system, clearly disclose:

1. **Not Official Turnitin**: 
   - This is an independent text similarity detection system
   - Uses different algorithms than Turnitin
   - Different source database (smaller, different coverage)
   - Results will differ from Turnitin

2. **What Similarity Scores Mean**:
   - Percentage = (Matching Words / Total Words) × 100
   - Measures text overlap, NOT plagiarism
   - Properly cited quotations and bibliographies still match
   - Common phrases and technical terms will match
   - High score ≠ automatic plagiarism
   - Low score ≠ automatic originality

3. **Source Database Limitations**:
   - Smaller corpus than Turnitin (90B+ vs our [SIZE])
   - Different source coverage (may miss sources Turnitin finds)
   - May find different sources than Turnitin
   - Cannot access paywalled content without partnerships
   - No global student submission repository

4. **Known Detection Gaps**:
   - Cannot detect semantic plagiarism (ideas without copied language)
   - Inconsistent with well-paraphrased content
   - May miss content not in our database
   - Cannot detect contract cheating (purchased papers not in DB)
   - Cannot detect translation plagiarism

5. **Independent Evaluation**:
   - Our matching algorithm evaluated on [DATASET]
   - Measured accuracy: [FPR]% false positive rate, [FNR]% false negative rate
   - Effective for verbatim copying, less so for paraphrasing
   - Link to full evaluation report: [URL]

6. **Manual Review Required**: 
   - Tool assists detection, does not prove misconduct
   - Educator must review all matches contextually
   - Consider citation practices, assignment type, field conventions
   - Student has right to explanation and appeal

7. **Transparent Methodology**:
   - Our algorithm: [Description]
   - Documented in: [URL]
   - Open-source components: [List]

### For End Users - AI Detection (If Built)

**⚠️ CRITICAL DISCLOSURES REQUIRED**:

1. **Not Official Turnitin**: 
   - This is an independent AI detection system
   - Uses different model than Turnitin
   - Completely different accuracy profile
   - Results NOT comparable to Turnitin percentages

2. **Probabilistic Nature - NOT Proof**:
   - AI detection is probabilistic screening, NEVER definitive proof
   - False positives occur (human writing flagged as AI)
   - False negatives occur (AI writing not detected)
   - Hybrid content (human + AI) is most challenging
   - Edited and humanized AI often evades detection

3. **Documented Accuracy Limitations**:
   - Overall accuracy: [X]% on test dataset
   - False positive rate: [Y]% (human flagged as AI)
   - False negative rate: [Z]% (AI not detected)
   - Hybrid content accuracy: [Lower]%
   - Edited AI accuracy: [Lower]%
   - Per-AI-model performance: [GPT-3.5: X%, GPT-4: Y%, etc.]
   - Test dataset composition: [Description]
   - Link to full evaluation: [URL]

4. **Known Biases**:
   - May flag non-native English speakers at higher rates
   - May flag neurodivergent writers disproportionately
   - May flag formulaic/technical writing
   - May flag assessment-specific language patterns
   - Bias tested on: [Populations]
   - Bias mitigation: [Strategies]

5. **File and Content Limitations**:
   - Only works on prose (300-30,000 words)
   - Does NOT work on: code, poetry, scripts, tables, bullet points
   - Language support: [English only initially]
   - Short documents (<300 words): Unreliable
   - Mixed format documents: Only prose portions analyzed

6. **Evolving AI Models**:
   - Newer AI models (GPT-5+) may evade detection better
   - Paraphrasing tools may bypass detection
   - "Humanizer" tools can make AI undetectable
   - Continuous model updates required to keep pace
   - No guarantee of detecting future AI tools

7. **Never Sole Evidence**:
   - MUST combine with additional evidence:
     - False references or "hallucinations"
     - Difference from student's previous work
     - Inconsistent writing style within document
     - Student cannot explain content
     - Lack of drafts or process evidence
   - Student has right to:
     - Explain their writing process
     - Show drafts and notes
     - Discuss content understanding
     - Appeal the finding

8. **No Automatic Actions**:
   - Results cannot trigger automatic penalties
   - Cannot auto-fail assignments
   - Cannot auto-report to administration
   - Must follow due process
   - Investigation and conversation required

9. **Usage Threshold**:
   - Only flag documents with [30%+] AI detection
   - Below threshold: Unreliable, high false positive risk
   - Sentence-level highlights: For reference only, not reliable evidence
   - Focus on document-level score

10. **Comparison to Published Research**:
    - Turnitin research shows: 43% hybrid accuracy, 60% humanized AI accuracy
    - Our system expected similar or lower accuracy
    - Cannot claim better performance than Turnitin without proof
    - Honest acknowledgment of limitations

11. **Alternative Resources Provided**:
    - Assignment redesign guidance
    - AI-resistant assessment strategies
    - Process-focused evaluation methods
    - AI literacy education resources
    - When detection is NOT appropriate

### For Institutions

**Legal/Policy Requirements**:

1. **Update Academic Integrity Policies**:
   - Define what AI tool use is permitted/prohibited
   - Specify how AI detection used (screening vs evidence)
   - Require multiple forms of evidence for allegations
   - Establish appeals process
   - Document student rights

2. **Training Requirements**:
   - Educators must be trained on tool limitations
   - Understand false positive/negative rates
   - Know how to interpret scores contextually
   - Recognize bias risks
   - Follow due process

3. **Student Notification**:
   - Inform students if AI detection is used
   - Explain how results are used
   - Provide tool limitations
   - Communicate rights (appeal, explanation)
   - Offer AI use guidance

4. **Consent and Privacy**:
   - Inform students if papers stored for future comparisons
   - Opt-out options for database inclusion (if offered)
   - Data retention policies
   - Third-party sharing policies (if any)

5. **Accessibility and Accommodation**:
   - Acknowledge bias risks for certain populations
   - Provide accommodations for students with disabilities
   - Consider neurodiversity in interpretation
   - Support for non-native speakers

### Documentation to Provide

**Must Create and Publish**:

1. **Technical Documentation**:
   - Algorithm description (similarity and AI detection)
   - Training data composition (if AI detection)
   - Evaluation methodology
   - Accuracy metrics with confidence intervals
   - Bias testing results
   - Known limitations

2. **User Guides**:
   - Educator guide: How to interpret results
   - Educator guide: When to use and not use tool
   - Educator guide: How to gather additional evidence
   - Student guide: What the tool does
   - Student guide: What scores mean
   - Student guide: Rights and appeals

3. **Comparison to Turnitin**:
   - Feature comparison table
   - Accuracy comparison (if data available)
   - Explicit statement of differences
   - No claims of equivalence
   - Honest assessment of gaps

4. **Evaluation Reports**:
   - Test dataset description
   - Methodology
   - Results (FPR, FNR, precision, recall, F1)
   - Bias testing results
   - Comparison to baseline/benchmarks
   - Limitations and future work

5. **Alternative Strategies**:
   - Assignment design guide
   - Process-based assessment examples
   - AI literacy curriculum
   - When detection is not appropriate
   - Pedagogical alternatives

---

## Acceptance Criteria for "Good Enough"

### Similarity Detection
- Matches exact quotes reliably
- Finds substantial copying consistently
- Excludes citations/bibliography correctly
- Provides source attribution
- **Does NOT need**: Identical percentage to Turnitin

### AI Writing Detection
- Performs better than random guessing
- Documented precision/recall metrics
- Handles edited AI text reasonably
- Provides useful confidence information
- **Does NOT need**: Identical accuracy to Turnitin

### Document Review
- Annotations persist accurately
- Common formats supported
- Reasonable performance
- **Does NOT need**: Every Canvas feature replicated exactly

---

## Update History

### 2026-10-18 - Initial Template
- Created limitations documentation framework
- Identified known proprietary constraints
- Defined disclosure requirements
- Established acceptance criteria for "good enough"

---

**Status**: Template - To Be Populated During Development  
**Last Updated**: 2026-10-18  
**Next Update**: After research phase completes
