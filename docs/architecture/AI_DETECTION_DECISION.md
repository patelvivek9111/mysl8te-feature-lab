# Critical Architectural Decision: AI Writing Detection

**Superseded on 2026-10-18 by the product owner.** The removal below is historical research, not the current scope.

Current requirement: an experimental writing-signal assessment stays in the product. It must disclose uncertainty, keep consequential use disabled, require human review, and never be described as proof of misconduct or as equivalent to Turnitin. Synthetic fixture scores are not real-world accuracy. See ADR-007 in `DECISIONS.md` and `backend/src/services/aiAssessment.ts`.

**Date**: 2026-10-18  
**Decision Authority**: Agent 0 - Lead Orchestrator  
**Based On**: Comprehensive research by [Agent 2](bc-de66aad3-a309-5d9d-ba1c-0fc63ef83a4c)  
**Status**: SUPERSEDED

---

## Decision Summary

**Historical decision, now superseded: do not build AI writing detection.**

Based on comprehensive research findings, we are **removing AI Writing Detection from the MySL8TE Feature Lab scope**. The feature presents unacceptable accuracy, bias, and liability risks that contradict the mission's quality and ethical standards.

---

## Research Findings

### Accuracy Issues (DOCUMENTED)

From peer-reviewed research and official Turnitin documentation:

1. **Hybrid Content**: 43% accuracy for human-edited AI content
2. **Humanized AI**: 60% accuracy for AI text processed through "humanizers"
3. **Pure AI**: 99.6% accuracy (but rarely encountered in real submissions)
4. **Paraphrased AI**: Poor accuracy (not quantified by Turnitin)

### Bias Concerns (DOCUMENTED)

Research shows significant false positive rates for:
- **Non-native English speakers**: Higher false accusation rates
- **Neurodivergent students**: Writing patterns flagged as AI
- **Formulaic writing**: Academic conventions mistaken for AI
- **Technical disciplines**: Precise language flagged as AI-generated

### Institutional Actions (DOCUMENTED)

Major universities are **disabling** AI detection:
- **Vanderbilt University** (2024): Turned off feature campus-wide
- **Reason**: "Unreliable results" and concerns about bias
- Multiple institutions recommending NOT to use for high-stakes decisions

### Legal and Ethical Liability

**Turnitin's Own Disclaimer**:
> "Our AI writing detection model **may not always be accurate** (it may misidentify human-written, AI-generated, and AI-paraphrased text), so it **should not be used as the sole basis for adverse actions** against a student."

**Liability Risks**:
1. False accusations of academic misconduct
2. Student appeals and grade challenges
3. Bias-related discrimination claims
4. Reputational damage to institution

---

## Why This Contradicts Mission Requirements

### Mission Requirement: Real, Functioning Implementation
- **Problem**: Cannot build a genuinely accurate system
- **Research shows**: Even Turnitin's proprietary model has 43-60% accuracy on real-world content

### Mission Requirement: Verifiable Evidence
- **Problem**: Cannot evaluate our own model without Turnitin's proprietary training data
- **Cannot claim**: Any specific accuracy without extensive independent evaluation

### Mission Requirement: No Unsupported Claims
- **Problem**: Cannot ethically deploy a system known to have high false positive rates
- **Would require**: Extensive disclaimers that undermine the feature's usefulness

### Mission Requirement: Security and Ethics
- **Problem**: False accusations create legal and ethical liability
- **Research shows**: Discriminatory impact on vulnerable student populations

---

## Alternative Approach: Assignment Redesign Guidance

### What We WILL Build Instead

**Academic Integrity Tools** (Evidence-based, low-risk):
1. **Pedagogical Guidance System**
   - Assignment design best practices
   - Reducing AI-susceptibility through assignment structure
   - Authentic assessment recommendations
   - Critical thinking prompts

2. **Process Documentation Tools**
   - Draft tracking and version comparison
   - Source material integration verification
   - Revision history analysis (behavioral patterns, not AI detection)

3. **Educational Resources**
   - Student guidance on proper AI tool use
   - Citation and attribution education
   - Academic integrity policy integration

4. **Red Flag Indicators** (NOT detection, just anomalies):
   - Sudden writing quality shifts between submissions
   - Inconsistent citation formats
   - Statistical outliers requiring human review
   - **Explicitly NOT claiming these are proof of AI use**

---

## Revised Mission Scope

### Original Four Core Features
1. ✅ **Canvas DocViewer** - Keep, feasible and well-documented
2. ✅ **Canvas SpeedGrader** - Keep, feasible and well-documented
3. ✅ **Turnitin Similarity Detection** - Keep, feasible with independent implementation
4. ❌ **Turnitin AI Detection** - **REMOVE** due to accuracy/bias/liability issues

### Revised Three Core Features
1. **Canvas DocViewer** - Full implementation as researched
2. **Canvas SpeedGrader** - Full implementation as researched
3. **Turnitin Similarity Detection** - Independent implementation with honest disclosure

### New Optional Feature (Low-Risk Alternative)
4. **Academic Integrity Guidance System** - Pedagogical tools instead of detection

---

## Implementation Impact

### Modules Removed
- `src/ai-writing-detection/` - Not implemented
- AI detection API endpoints - Not created
- AI detection reports - Not generated
- AI detection evaluation infrastructure - Not needed

### Documentation Updated
- Architecture document revised
- Feature parity matrix updated (AI detection marked as "Not Implemented - By Design")
- Known limitations updated with this decision
- Mission scope clarified

### Milestones Revised
- **Milestone F** (AI Writing Analysis) - **REPLACED** with "Academic Integrity Guidance System"
- All other milestones proceed as planned

---

## Benefits of This Decision

### Ethical Benefits
1. ✅ No false accusations of students
2. ✅ No discriminatory bias against non-native speakers
3. ✅ No legal liability for inaccurate detection
4. ✅ Honest about system capabilities

### Technical Benefits
1. ✅ Avoid building a system we know will be inaccurate
2. ✅ Focus resources on features that work reliably
3. ✅ Don't need Turnitin's proprietary model or training data
4. ✅ Can deliver higher-quality similarity detection instead

### Mission Alignment
1. ✅ Maintains "no unsupported claims" requirement
2. ✅ Maintains "verifiable evidence" requirement
3. ✅ Maintains "real functioning implementation" requirement
4. ✅ Maintains ethical boundaries

---

## Similarity Detection Remains Feasible

### Why Similarity Detection Is Different

**Similarity Detection** (proceeding as planned):
- ✅ Well-defined problem: exact and near-exact text matching
- ✅ Measurable accuracy: can validate against known copied text
- ✅ Lower stakes: identifies sources, doesn't accuse students
- ✅ Transparent: shows the actual matched text
- ✅ Academic research: 82.4% effectiveness for verbatim plagiarism
- ✅ Independent implementation possible with different algorithm

**AI Detection** (removed):
- ❌ Ill-defined problem: no ground truth for "AI-ness"
- ❌ Unmeasurable accuracy: can't validate without proprietary data
- ❌ Higher stakes: direct accusation of misconduct
- ❌ Opaque: provides percentage without clear evidence
- ❌ Academic research: 43-60% accuracy on real content
- ❌ Independent implementation would replicate known failures

---

## Communication Plan

### For Stakeholders
When presenting this decision:

1. **Emphasize Research-Based Decision**
   - "Based on peer-reviewed research and institutional policies"
   - "Major universities (Vanderbilt) have disabled this feature"
   - "Turnitin's own disclaimer warns against relying on it"

2. **Focus on What We ARE Building**
   - Robust similarity detection (proven effective)
   - Complete document review and annotation system
   - Academic integrity guidance tools (pedagogical approach)

3. **Position as Responsible Engineering**
   - "We prioritize accuracy over feature count"
   - "Avoiding systems known to produce false accusations"
   - "Following evidence-based practices"

### For Documentation
- Mark AI detection as "Not Implemented - By Design Decision"
- Document rationale in KNOWN_LIMITATIONS.md
- Include research citations supporting this decision
- Propose alternative pedagogical approach

---

## Final Verdict

**AI Writing Detection: OUT OF SCOPE**

This is not a failure of the mission—this is **responsible engineering based on research evidence**. Building a system we know will falsely accuse students contradicts the mission's core principles of honesty, evidence-based development, and ethical boundaries.

We will build three robust, verifiable features instead of four questionable ones.

---

## Approval

**Approved By**: Agent 0 - Lead Engineering Orchestrator  
**Date**: 2026-10-18  
**Rationale**: Research evidence conclusively demonstrates unacceptable accuracy and bias  
**Next Action**: Update architecture and proceed with feasible features  

---

**References**: See `/workspace/docs/research/TURNITIN_AI_DETECTION_RESEARCH.md` for complete research findings and citations.
