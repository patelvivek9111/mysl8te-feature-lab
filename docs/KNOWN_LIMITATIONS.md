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

#### Proprietary Components (UNAVAILABLE)
1. **Matching Algorithm**: Turnitin's exact matching algorithm is proprietary
   - **Our Approach**: Independent implementation using text similarity techniques
   - **Difference**: Cannot guarantee identical match results
   - **Validation**: Will benchmark against known test cases

2. **Source Corpus**: Turnitin's submission database is inaccessible
   - **Our Approach**: Build independent corpus from authorized sources
   - **Difference**: Smaller corpus, different source coverage
   - **Impact**: May find different or fewer sources than Turnitin

3. **Scoring Formula**: Exact similarity percentage calculation is proprietary
   - **Our Approach**: Independent percentage calculation based on matched passages
   - **Difference**: Percentages may differ from Turnitin
   - **Validation**: Document calculation methodology

#### Intentionally Different Features
*To be documented after research*

### Turnitin AI Writing Detection

#### Proprietary Components (UNAVAILABLE)
1. **Detection Model**: Turnitin's AI detection model is proprietary
   - **Our Approach**: Independent model or third-party AI detection service
   - **Difference**: Cannot claim identical detection accuracy
   - **Validation**: Must create evaluation dataset and measure performance

2. **Training Data**: Turnitin's training corpus is confidential
   - **Our Approach**: Independent training data or pre-trained models
   - **Difference**: May have different strengths/weaknesses
   - **Impact**: Detection performance will differ

3. **Confidence Calibration**: Exact confidence scoring is proprietary
   - **Our Approach**: Independent confidence measurement
   - **Difference**: Scores not directly comparable
   - **Transparency**: Document methodology and limitations

#### Performance Limitations
*To be documented after evaluation*

Example expected limitations:
- Different false positive/negative rates
- Different handling of edge cases (edited AI text, non-English, etc.)
- Different confidence calibration
- Different passage-level granularity

#### Ethical Constraints
1. **Not Proof of Authorship**: AI detection is probabilistic, not definitive
2. **Manual Review Required**: Results should inform, not dictate, academic decisions
3. **Transparency**: Clear disclosure that this is not Turnitin's system
4. **No Automatic Penalties**: Detection results alone should not trigger automated actions

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

### For End Users
When deploying this system, clearly disclose:

1. **Not Official Turnitin**: This is an independent similarity and AI detection system, not Turnitin
2. **Different Results Expected**: Similarity percentages and AI detection scores will differ from Turnitin
3. **Independent Evaluation**: Detection accuracy has been independently evaluated (link to evaluation report)
4. **Probabilistic Detection**: AI detection is probabilistic and should inform, not determine, academic decisions
5. **Manual Review Required**: Human judgment essential for academic integrity decisions
6. **System Limitations**: Reference limitations documentation

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
