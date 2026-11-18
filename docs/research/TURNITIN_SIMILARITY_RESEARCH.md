# Turnitin Similarity Detection Research

## Document Status
- **Research Date**: 2026-10-18
- **Lead Agent**: Agent 2 - Turnitin Reverse Engineering Specialist
- **Research Method**: Public documentation review, official guides, academic papers, video demonstrations
- **Evidence Classification**: DOCUMENTED (official sources) and INFERRED (from observable behavior)

## Executive Summary

Turnitin Similarity Detection is a text-matching tool that compares submitted documents against billions of web pages, millions of academic publications, and previously submitted student papers. It generates a percentage-based similarity score and highlights matching passages with source attribution. The system uses proprietary "fingerprinting" technology to identify text fragments and their sequences. While the exact algorithms are unavailable, the observable behavior and workflow are extensively documented.

**Key Finding**: Turnitin explicitly states it does NOT detect plagiarism—it detects text similarity. Educators must interpret matches using academic judgment.

---

## 1. Document Upload and Processing Workflow

### 1.1 File Requirements (DOCUMENTED)

**Source**: [Turnitin Official File Requirements Guide](https://guides.turnitin.com/hc/en-us/articles/23929463501965)

**Supported Formats**:
- Microsoft Word (.doc, .docx)
- Adobe PDF (.pdf) - must contain selectable text
- Rich Text Format (.rtf)
- Plain Text (.txt)
- HTML
- OpenOffice (.odt)
- Hangul (.hwp, .hwpx)
- PowerPoint (.pptx, .ppt, .ppsx, .pps)
- Excel (.xls, .xlsx)
- Google Docs (via Google Drive)
- Corel WordPerfect
- Adobe PostScript

**File Constraints**:
- Maximum size: 100 MB
- Maximum pages: 800
- Minimum word count: 20 words (for similarity checking)
- Text must be selectable/copyable (not scanned images)

**Rejected File Types**:
- Password-protected files
- Microsoft Works (.wps)
- Macro-enabled Word files (.docm)
- Apple Pages
- Image-only PDFs
- PDF forms, portfolios
- OpenOffice files created in Google Docs
- Files with visual effects

### 1.2 Processing Timeline (DOCUMENTED)

**Source**: [Turnitin Processing Guide](https://guides.turnitin.com/hc/en-us/articles/37681566959373)

**Normal Processing**:
- Initial submission: 10-15 minutes typical
- Can be as fast as 10 seconds on Turnitin's infrastructure
- Reports generate at approximately 20 reports/second system-wide
- Over 1 million submissions processed on peak days

**Resubmission Handling**:
- First 3 resubmissions: Generate new report immediately
- 4th+ resubmission: 24-hour delay enforced to prevent gaming the system
- Resubmissions can match against previous versions until overwritten

**Error Conditions** (DOCUMENTED):
- "Processing" status: Normal, wait a few minutes
- "Failed to Process": File format issue, dense vector images, or first page is image-only
- "Timed Out": Processing timeout, usually file-related issue
- "M14:11 Error": Session expired or report unavailable

### 1.3 Submission Storage Options (DOCUMENTED)

**Source**: [Assignment Settings Documentation](https://help.turnitin.com/feedback-studio/canvas/plagiarism-framework/teacher/assignment-setup/turnitin-settings.htm)

Instructors configure where submissions are stored:
1. **Standard Paper Repository**: Global repository accessible to all Turnitin users
2. **Institution Paper Repository**: Private institutional repository only
3. **No Storage**: Report generated but paper not stored for future comparisons

**Evidence Classification**: DOCUMENTED

---

## 2. Similarity Percentage Calculation

### 2.1 Calculation Method (DOCUMENTED)

**Source**: [Understanding Similarity Score](https://guides.turnitin.com/hc/en-us/articles/23435833938701)

**Formula**:
```
Similarity Score = (Matching Words / Total Words) × 100
```

**Observable Behavior**:
- Percentage represents proportion of text matching sources in database
- Color-coded ranges (though may vary by integration):
  - Blue: 0% (no matches)
  - Green: 1-24%
  - Yellow: 25-49%
  - Orange: 50-74%
  - Red: 75-100%

**Important Disclaimers** (DOCUMENTED):
- There is NO "acceptable" or "good" similarity score
- High scores do not automatically indicate plagiarism
- Properly cited quotations and bibliographies still show as matches
- Score is a tool for review, not a verdict

**Evidence Classification**: DOCUMENTED (formula), INFERRED (internal weighting)

### 2.2 Matching Technology (DOCUMENTED/INFERRED)

**Source**: [Turnitin Blog - Detection Details](https://www.turnitin.com/blog/the-detection-is-in-the-details)

**Fingerprinting Approach** (DOCUMENTED):
1. Document broken into meaningful phrases
2. Common words ("the", "and", "or") removed
3. Each phrase assigned unique "fingerprint" ID
4. Each submission can contain up to 80,000 phrase IDs
5. Compared against 7 trillion possible phrase matches
6. Natural language processing applied to reduce false positives
7. Detects unusual patterns (hidden text, replaced characters)

**What This Detects**:
- Verbatim copying
- Word-for-word matches
- Poorly paraphrased content (sequences preserved)
- Distinctive word-fragment sequences

**What This Cannot Reliably Detect**:
- Semantic plagiarism (ideas without copying language)
- Well-paraphrased content
- Heavily modified text

**Evidence Classification**: DOCUMENTED (high-level), UNAVAILABLE (exact algorithm)

---

## 3. Source Matching and Attribution

### 3.1 Database Sources (DOCUMENTED)

**Source**: [Web Settings Guide](https://guides.ithenticate.com/hc/en-us/articles/27585939990157)

**Available Repositories**:

1. **Internet**
   - 90+ billion current and archived web pages
   - Active web crawler continuously indexing
   - Includes removed/archived content

2. **Publications**
   - 170+ million articles
   - Academic journals and periodicals
   - Library databases
   - Textbook publishers
   - Digital reference collections
   - Subscription-based publications
   - Books
   - Theses and dissertations (via ProQuest)

3. **Submitted Works**
   - Previously submitted student papers
   - Global repository or institution-only
   - Over 1.2 billion student submissions

4. **Crossref Content** (Premium)
   - Published scholarly works
   - Posted content (pre-publication)

**Configurable Search** (DOCUMENTED):
Instructors can enable/disable specific repositories per assignment.

**Evidence Classification**: DOCUMENTED

### 3.2 Match Prioritization (DOCUMENTED)

**Source**: [New Similarity Report Overview](https://guides.turnitin.com/hc/en-us/articles/24194876779661)

**Overlapping Source Resolution**:
When identical text appears in multiple sources, prioritization order:
1. Internet sources (highest priority)
2. Publications
3. Submitted Works (student papers)

**Source Display**:
- Sources ranked by total similarity percentage (descending)
- Each source shows:
  - Source ranking number
  - Database type
  - Percentage of document matching this source
  - Number of text blocks matched
  - Total word count of matches

**Evidence Classification**: DOCUMENTED

---

## 4. Passage-Level Highlighting and Match Groups

### 4.1 Match Groups Feature (DOCUMENTED)

**Source**: [Match Groups Documentation](https://guides.turnitin.com/hc/en-us/articles/28057483210637)

**Four Categories** (color-coded):

1. **Not Cited or Quoted**
   - No quotation marks AND no citation
   - Highest concern category

2. **Missing Quotations**
   - Has in-text citation
   - Match is exact enough to require quotation marks
   - Potentially improper paraphrasing

3. **Missing Citation**
   - Has quotation marks
   - Lacks citation to original source
   - Missing attribution

4. **Cited and Quoted**
   - Both quotation marks and citation present
   - Properly attributed (may still need formatting review)

**Citation Detection Technology** (DOCUMENTED):
- Machine learning model trained on English content
- Recognizes formats: APA, MLA, Turabian, IEEE
- May recognize other formats but less reliably
- Citation must be near matched text (proximity-based)

**Quotation Mark Recognition**:
Recognizes: `"..."`, `'...'`, `«...»`, `»...«`, `„…"`, `『...』`, `「...」`
Does NOT recognize if space separates mark from text: `" text"`

**Limitations** (DOCUMENTED):
- Currently English content only
- May not recognize unconventional citation formats
- Distance between citation and text affects detection

**Evidence Classification**: DOCUMENTED

### 4.2 Source Cards and Navigation (DOCUMENTED)

**Source**: [New Similarity Report Overview](https://guides.turnitin.com/hc/en-us/articles/24194876779661)

**Source Card Contents**:
- Top row: Source number, database type, match group
- Second row: Source name, percentage matched
- Third row: Number of matching blocks, total word count

**Navigation Features**:
- Click highlight in document → jumps to source card
- Click source card → highlights corresponding text
- Multiple matches per source: Use arrows (< >) to navigate between matches
- Overlapping sources: "View other sources" option expands list

**Evidence Classification**: DOCUMENTED

---

## 5. Exclusion Controls

### 5.1 Filter and Exclusion Types (DOCUMENTED)

**Source**: [Using Exclusions and Filters](https://guides.turnitin.com/hc/en-us/articles/23503006879885)

**Available Exclusions**:

1. **Bibliography Exclusion**
   - Removes matches in reference lists
   - Common since bibliographies naturally match

2. **Quoted Text Exclusion**
   - Removes text in quotation marks
   - Useful for assignments with many legitimate quotes

3. **Cited Text Exclusion**
   - Removes text with detected in-text citations
   - Focuses on uncited material

4. **Small Match Exclusion**
   - By word count: Minimum 8 words (default threshold)
   - Removes short phrase matches
   - Example: 10-word threshold excludes all sources with <10 cumulative matching words

5. **Abstract/Methods/Materials Exclusion** (Some versions)
   - Removes standard academic paper sections

**Small Source Exclusion** (Classic report only):
- Excludes entire sources below threshold
- By percentage or word count
- Works at source level, not match level

**Known Issue** (DOCUMENTED):
- New report: Percentage-based small match threshold not supported
- New report: Assignment-level small match settings not applied
- Workaround: Use classic report view for percentage thresholds

**Evidence Classification**: DOCUMENTED

### 5.2 Manual Exclusions (DOCUMENTED)

**Source**: [Managing Filters and Exclusions](https://guides.ithenticate.com/hc/en-us/articles/27839726023565)

**Match-Level Exclusion**:
- Select specific highlighted match
- Click "Exclude Match" button
- Removes from similarity calculation
- Adjusts overall percentage

**Source-Level Exclusion**:
- Select entire source
- Click "Exclude Source" icon
- Removes all matches from that source
- Useful for excluding student's own previous work

**Restoration**:
- View exclusions list (link below Overall Similarity)
- Individual restoration: "Include Source" icon
- Bulk restoration: "Include All Sources" button

**Evidence Classification**: DOCUMENTED

---

## 6. Report Recalculation and Revisions

### 6.1 Dynamic Recalculation (DOCUMENTED)

**Observable Behavior**:
- Applying filters/exclusions recalculates percentage in real-time
- Excluding a source may not always change overall score if overlapping sources exist
- Changes persist per report view (classic vs. new)
- Changes do NOT transfer between report versions

**Evidence Classification**: DOCUMENTED (behavior), INFERRED (calculation triggers)

### 6.2 Report Storage and Retention (DOCUMENTED)

**Source**: [Troubleshooting Guide](https://guides.turnitin.com/hc/en-us/articles/37681566959373)

**Retention Policy**:
- Reports stored for 180 days after class end date (contractual minimum)
- May be retained longer in practice
- Can be removed due to:
  - Account administrator requests
  - Overwrites from resubmissions
  - Turnitin data maintenance

**Multiple Report Versions**:
- Classic report and new report maintain separate states
- Filter/exclusion changes saved per version
- Both versions show same underlying matches

**Evidence Classification**: DOCUMENTED

---

## 7. Instructor Control Panel

### 7.1 Assignment-Level Settings (DOCUMENTED)

**Source**: [Creating Assignment Documentation](https://guides.turnitin.com/hc/en-us/articles/23652443233293)

**Configurable Options**:

1. **Repository Selection**:
   - Choose which databases to search against
   - Enable/disable internet, publications, student papers, institutional repository

2. **Storage Options**:
   - Standard repository, institutional only, or no storage

3. **Report Generation Timing**:
   - Immediately (for formative feedback)
   - On due date only
   - Instructor-only vs. student access

4. **Resubmission Settings**:
   - Allow/disallow resubmissions
   - Configure resubmission limits

5. **Report Visibility**:
   - Show similarity report to students (yes/no)
   - Timing of visibility

6. **Default Exclusions**:
   - Pre-configure bibliography/quote exclusions
   - Set small match thresholds

**Evidence Classification**: DOCUMENTED

### 7.2 Submission Management (DOCUMENTED)

**Source**: [Managing Standard Assignment](https://guides.turnitin.com/hc/en-us/articles/36460423146253)

**Instructor Actions**:
- View submission list with similarity scores
- Search for specific students (disabled in very large classes until pages loaded)
- Refresh reports without page reload
- Bulk download options (see section 8)
- Submit on behalf of student
- Grant extensions
- Request submission deletion
- Resync grades to LMS

**Evidence Classification**: DOCUMENTED

---

## 8. Report Export Formats

### 8.1 Individual Report Downloads (DOCUMENTED)

**Source**: [Downloading and Sharing Reports](https://guides.turnitin.com/hc/en-us/articles/27881575386125)

**PDF Export Options**:
1. **Similarity Report**
   - Includes highlighted matches
   - Shows current view with active layers
   - Three sections:
     - Page 1: Report metadata (similarity score, upload date, etc.)
     - Body: Full paper text with highlighted matches
     - End: Source list with color coding

2. **Grading and Feedback Report**
   - Paper with instructor feedback
   - No similarity highlighting

3. **Original File**
   - Unmodified student submission
   - Original file format

**Download Process**:
- Select layers to include
- Click download icon
- Large files take several minutes to prepare
- Must stay on page during preparation

**Evidence Classification**: DOCUMENTED

### 8.2 Bulk Download Options (DOCUMENTED)

**Source**: [Managing Standard Assignment](https://guides.turnitin.com/hc/en-us/articles/36460423146253)

**Available Bulk Downloads**:
1. **Submission List** (CSV)
   - Student names/emails
   - Submission dates
   - Similarity scores
   - AI writing percentages

2. **All Reports and Files**
   - Original submissions
   - Similarity reports
   - Grading/feedback
   - AI writing reports
   - Organized in folders by type and student name

3. **Similarity Reports Only** (PDF)

4. **AI Writing Reports Only** (PDF)

5. **Grading and Feedback Reports Only** (PDF)

6. **Originally Submitted Files Only** (native formats)

**Bulk Download Constraints**:
- Downloads split into multiple ZIPs if >500 files
- Must keep window open during processing
- Standard Assignment only (not Classic)

**Evidence Classification**: DOCUMENTED

---

## 9. Cross-Submission Matching Behavior

### 9.1 Student Collusion Detection (DOCUMENTED)

**Source**: [Understanding Similarity Score](https://guides.turnitin.com/hc/en-us/articles/23435833938701)

**Observable Behavior**:
- Student submissions match against each other
- Earlier submission has lower score
- Later submission (copied work) has 100% score
- Example: Jane writes paper (25% score), Eric submits Jane's paper later (100% score)

**Detection Requirements**:
- Papers must be stored in repository
- Reports set to generate "immediately (overwrite until due date)" OR "on due date"
- Final check runs after due date to ensure equal scrutiny

**Evidence Classification**: DOCUMENTED

### 9.2 Matching Against Own Previous Work (DOCUMENTED)

**Observable Behavior**:
- Students can match against their own prior submissions
- Useful for detecting unauthorized reuse of old papers
- Can be excluded manually if self-citation is permitted

**Evidence Classification**: DOCUMENTED

---

## 10. Format-Specific Handling

### 10.1 PDF Handling (DOCUMENTED)

**Requirements**:
- Text must be selectable/copyable
- Cannot be image-based or scanned document
- Test: Copy/paste into plain text editor
- If no text appears → rejected

**Recommended PDF Creation**:
- Adobe Acrobat
- Microsoft Word 365
- Google Docs

**Rejected PDFs**:
- PDF forms
- PDF portfolios
- PDFs with embedded files
- Image-only first page

**Evidence Classification**: DOCUMENTED

### 10.2 Word Document Handling (DOCUMENTED)

**Accepted**:
- .doc (Word 97-2003)
- .docx (Word 2007+)

**Rejected**:
- .docm (macro-enabled)
- .doc files created in OpenOffice (not 100% compatible)
- Password-protected documents

**Evidence Classification**: DOCUMENTED

### 10.3 PowerPoint/Spreadsheet Handling (DOCUMENTED)

**PowerPoint**:
- .pptx, .ppt, .ppsx, .pps accepted
- Each slide counts as a page
- Text with visual effects not supported (shadows, 3D)
- "Slate" theme not supported (makes text unselectable)

**Excel**:
- .xls, .xlsx accepted
- No hidden sheets allowed
- Content must fit printable area

**Evidence Classification**: DOCUMENTED

---

## 11. Error Conditions and Edge Cases

### 11.1 Processing Failures (DOCUMENTED)

**Source**: [Troubleshooting Guide](https://guides.turnitin.com/hc/en-us/articles/37681566959373)

**Common Failure Causes**:
1. Dense vector images (AI, EPS, WMF, PICT) → Replace with raster images
2. Image-only first page → Add text to first page
3. Third-party PDF converters → Use trusted source
4. Password protection → Remove password
5. Unsupported file type → Convert to PDF
6. Expired class (>180 days past end date)

**Error Messages**:
- "M14:11 Error": Session expired or report unavailable
- "Oops! Issue loading report": Excessive processing time
- "Failed to Process": File issue
- "Timed Out": Processing timeout

**Evidence Classification**: DOCUMENTED

### 11.2 Edge Cases (DOCUMENTED/INFERRED)

**Very Short Documents**:
- Minimum 20 words required
- Below minimum: No report generated

**Very Long Documents**:
- Maximum 800 pages
- Maximum 30,000 words (for AI detection)
- Above limits: Rejected

**Special Characters**:
- System checks for hidden text
- Detects replaced characters (obfuscation attempts)

**Evidence Classification**: DOCUMENTED (limits), INFERRED (obfuscation detection details)

---

## 12. Known Limitations and Disclaimers

### 12.1 Turnitin's Own Disclaimers (DOCUMENTED)

**Source**: Multiple official guides

**Explicit Statements**:
1. "Turnitin does NOT check for plagiarism" - Only detects text similarity
2. "There is NO acceptable similarity score" - Context-dependent
3. "Highlighted matches do not always indicate plagiarism" - Could be proper citation
4. "Educators must use academic judgment" - Tool assists, doesn't decide
5. "Close review of suspected material is essential" - Human review required

**Evidence Classification**: DOCUMENTED

### 12.2 Academic Research Findings (DOCUMENTED)

**Source**: Academic papers on Turnitin efficacy

**Key Findings**:

1. **2009 Study** (Journal of Web Librarianship):
   - 82.4% detection rate for deliberate plagiarism
   - 16.8% combined false-positive rate
   - Close review still essential

2. **2016 Thesis** (University of Ontario):
   - Effective for verbatim text matching
   - Inconsistent with paraphrased content
   - Gap in detecting subscription journal content without Turnitin agreements
   - Older articles less likely to be detected
   - Common references/phrases frequently flagged (coincidental matches)
   - Cannot assess semantic plagiarism

3. **2019 Study** (Biology Lab Reports):
   - Average 29 similarity hits per report
   - Only 2 significant problems per report after filtering
   - 53% had at least one source incorporation problem
   - Most matches were not plagiarism
   - Common issues: patchwriting, technical parroting, copying, source falsification

4. **2012 Study** (Second Language Writers):
   - Deterrent effect demonstrated
   - Awareness of Turnitin reduced matching text and intentional plagiarism
   - Raw percentages did not always reflect intentional plagiarism

5. **2021 Scoping Review** (129 studies):
   - No conclusive evidence that text-matching software alone reduces plagiarism
   - No evidence of improved learning from text-matching alone

**Evidence Classification**: DOCUMENTED (research findings)

### 12.3 Technical Limitations (INFERRED from documentation)

**Cannot Detect**:
- Semantic plagiarism (ideas without copied language)
- Well-executed paraphrasing
- Translation plagiarism (content translated from other languages)
- Content from sources not in database
- Content behind paywalls not partnered with Turnitin
- Collusion completed before assignment creation
- Contract cheating (purchased papers not in database)

**Evidence Classification**: INFERRED from system design

---

## 13. Independent Implementation Requirements

### 13.1 Observable Behaviors to Replicate

**Critical Features** (in priority order):

1. **Document Processing**
   - Accept common formats (PDF, DOCX, TXT, RTF)
   - Extract text reliably
   - Handle resubmissions

2. **Text Comparison**
   - Compare against reference corpus
   - Identify matching passages
   - Calculate similarity percentage

3. **Source Attribution**
   - Show which sources matched
   - Display match locations in document
   - Provide source URLs/citations

4. **Highlighting and Navigation**
   - Highlight matched passages in original document
   - Color-code or otherwise distinguish match types
   - Navigate between matches

5. **Exclusion Controls**
   - Exclude quotes
   - Exclude bibliography
   - Exclude small matches
   - Manual exclusion of specific matches/sources

6. **Report Export**
   - PDF export with highlights
   - Original document download
   - Report metadata

**Evidence Classification**: DOCUMENTED (required behaviors)

### 13.2 Proprietary Components (UNAVAILABLE)

**Cannot Be Replicated**:

1. **Exact Matching Algorithm** (UNAVAILABLE)
   - Fingerprinting implementation details
   - Phrase ID generation method
   - Natural language processing heuristics
   - False positive reduction techniques
   - Hidden text detection methods

2. **Source Corpus** (UNAVAILABLE)
   - 90+ billion web pages
   - 170+ million academic articles
   - 1.2+ billion student submissions
   - Crossref partnerships
   - Publisher agreements

3. **Exact Scoring Formula** (UNAVAILABLE)
   - Internal weighting of matches
   - Confidence scoring
   - Match prioritization logic

4. **Server Infrastructure** (UNAVAILABLE)
   - Processing pipeline details
   - Distributed comparison system
   - Caching mechanisms

**Evidence Classification**: UNAVAILABLE (proprietary)

### 13.3 Independent Implementation Approaches

**For Text Matching**:
- Use open-source algorithms: Winnowing, Rabin-Karp, suffix trees
- Consider existing libraries: MOSS, JPlag (for code), plagiarism detection libraries
- Implement n-gram matching with configurable granularity
- Use TF-IDF for document similarity
- Consider semantic similarity (word embeddings) for paraphrase detection

**For Source Corpus**:
- Build from authorized sources:
  - Web crawl with robots.txt compliance
  - Partner with open-access repositories
  - Use public domain content
  - Store user submissions (with consent)
- Start small, grow over time
- Focus on quality over quantity initially

**For User Interface**:
- Replicate observable UX patterns
- Highlight matches with source numbers
- Provide side-by-side view
- Allow exclusion controls
- Export to PDF

**Evidence Classification**: INFERRED (implementation approach)

---

## 14. Evaluation Methodology

### 14.1 Testing Our Implementation

**Evaluation Criteria**:
1. **Verbatim Match Detection**: Can detect exact copied passages
2. **Paraphrase Detection**: Can detect poorly paraphrased content (stretch goal)
3. **False Positive Rate**: Minimize innocent matches
4. **Quote Recognition**: Properly handle quoted material
5. **Bibliography Recognition**: Identify reference sections
6. **Performance**: Reasonable processing time
7. **Accuracy**: Percentage calculation correlates with actual copying

**Test Datasets**:
- Create controlled test cases with known copying levels
- Use public academic integrity test corpora
- Compare with manual review results
- Cannot directly compare with Turnitin (different algorithms)

**Evidence Classification**: INFERRED (evaluation approach)

---

## 15. Disclosure and Ethical Requirements

### 15.1 Required User Disclosures (INFERRED from ethical practices)

**Must Disclose to Users**:
1. This is NOT Turnitin—independent implementation
2. Results will differ from Turnitin
3. Different source corpus (smaller, different coverage)
4. Different matching algorithm (different strengths/weaknesses)
5. Similarity percentage is NOT plagiarism score
6. Human review required for academic decisions
7. Tool assists detection, does not prove misconduct

### 15.2 Institutional Guidelines (INFERRED from Turnitin use)

**Best Practices**:
1. Clearly communicate tool limitations to students
2. Explain what similarity score means
3. Provide writing instruction alongside detection
4. Use as teaching tool, not only enforcement
5. Allow students to learn from similarity reports
6. Consider formative use (pre-submission review)
7. Never use similarity score alone as evidence
8. Provide due process for academic integrity cases

**Evidence Classification**: INFERRED from ethical AI practices

---

## 16. Competitive Landscape

### 16.1 Alternative Systems (DOCUMENTED)

**Other Text-Matching Tools**:
- SafeAssign (Blackboard)
- Copyleaks
- Grammarly Plagiarism Checker
- Quetext
- PlagScan
- Unicheck

**Evidence Classification**: DOCUMENTED (existence), not researched in detail

---

## 17. Key Sources and Evidence

### 17.1 Official Documentation

1. [Overview of new Similarity Report](https://guides.turnitin.com/hc/en-us/articles/24194876779661)
2. [Understanding the similarity score](https://guides.turnitin.com/hc/en-us/articles/23435833938701)
3. [Match Groups documentation](https://guides.turnitin.com/hc/en-us/articles/28057483210637)
4. [Using exclusions and filters](https://guides.turnitin.com/hc/en-us/articles/23503006879885)
5. [File requirements](https://guides.turnitin.com/hc/en-us/articles/23929463501965)
6. [Troubleshooting report errors](https://guides.turnitin.com/hc/en-us/articles/37681566959373)

### 17.2 Turnitin Blog Posts

1. [How Turnitin finds text similarity](https://www.turnitin.com/blog/how-to-bring-deeper-meaning-to-the-similarity-score)
2. [Detection is in the details](https://www.turnitin.com/blog/the-detection-is-in-the-details)

### 17.3 Academic Research

1. Weber-Wulff et al. (2009) - Efficacy study, Journal of Web Librarianship
2. Walchuk, K. (2016) - Efficacy thesis, University of Ontario
3. Bertram Gallant et al. (2019) - Biology lab reports study
4. Stapleton, P. (2012) - Deterrent effect study

### 17.4 Video Demonstrations

1. [Turnitin Feedback Studio Quick Start for Instructors](https://www.youtube.com/watch?v=ql0kayK8Hio)
2. [Understanding the Similarity Report (Student View)](https://www.youtube.com/watch?v=oI-TrsyJvo4)

---

## 18. Conclusions

### 18.1 What We Know (DOCUMENTED)

1. **Workflow**: Document upload → text extraction → fingerprint generation → database comparison → report generation
2. **Calculation**: Simple ratio of matching words to total words
3. **Display**: Highlighted passages with source attribution
4. **Exclusions**: Quote, bibliography, citation, and small match filtering
5. **Limitations**: Does NOT detect plagiarism, only similarity
6. **Best Practice**: Human review always required

### 18.2 What We Don't Know (UNAVAILABLE)

1. **Exact algorithm** for fingerprint generation
2. **Proprietary heuristics** for false positive reduction
3. **Database composition** and partnerships
4. **Server-side** implementation details
5. **Match weighting** and prioritization logic

### 18.3 What We Can Build

An independent text similarity detection system that:
1. Processes common document formats
2. Compares against open corpus
3. Highlights matching passages
4. Provides source attribution
5. Allows exclusion controls
6. Exports reports
7. Calculates similarity percentage

**Critical**: Our implementation will have different results than Turnitin due to different algorithms and source corpus. We must clearly disclose this to users.

---

## 19. Next Steps for Implementation

1. **Phase 1**: Document processing and text extraction
2. **Phase 2**: Text comparison algorithm implementation
3. **Phase 3**: Source corpus creation/integration
4. **Phase 4**: User interface with highlighting
5. **Phase 5**: Exclusion controls
6. **Phase 6**: Report export
7. **Phase 7**: Evaluation and validation
8. **Phase 8**: Documentation and disclosure

---

**Research Status**: COMPLETE  
**Last Updated**: 2026-10-18  
**Next Action**: Create AI Detection research document and update matrices
