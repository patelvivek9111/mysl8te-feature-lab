# Canvas DocViewer Research

**Status**: Complete  
**Date**: 2026-10-18  
**Research Agent**: Agent 1 - Canvas Reverse Engineering Specialist  
**Mission**: MySL8TE Feature Lab - Canvas DocViewer Investigation

---

## Executive Summary

Canvas DocViewer is Instructure's document preview and annotation tool integrated with SpeedGrader for assignment feedback. It converts uploaded documents to PDF format for web-based viewing and annotation. This research documents all publicly observable features, behaviors, and technical details discovered through official documentation, community resources, and API documentation.

---

## Table of Contents

1. [Document Support](#document-support)
2. [Document Rendering](#document-rendering)
3. [Viewer Controls](#viewer-controls)
4. [Annotation Types](#annotation-types)
5. [Annotation Properties](#annotation-properties)
6. [Comment System](#comment-system)
7. [Annotation Persistence](#annotation-persistence)
8. [Coordinate System](#coordinate-system)
9. [Draft vs Published Workflow](#draft-vs-published-workflow)
10. [Permissions & Visibility](#permissions--visibility)
11. [Export Functionality](#export-functionality)
12. [Keyboard Shortcuts & Accessibility](#keyboard-shortcuts--accessibility)
13. [Mobile Support](#mobile-support)
14. [Session Management](#session-management)
15. [Error Handling & Edge Cases](#error-handling--edge-cases)
16. [API Integration](#api-integration)
17. [Known Limitations](#known-limitations)

---

## Document Support

### Supported File Types
**Evidence Level**: DOCUMENTED

**Source**: [Canvas Community - Supported Files](https://community.instructure.com/en/kb/articles/662858-what-types-of-files-can-i-preview-in-canvas)

Canvas DocViewer supports the following document formats:

| Category | Formats |
|----------|---------|
| **Microsoft Word** | .doc, .docx, .docm, .dot, .dotx, .dotm, .rtf |
| **Microsoft Excel** | .xls, .xlsx, .xlsm, .xlsb |
| **Microsoft PowerPoint** | .ppt, .pptx, .pps, .ppsx |
| **Microsoft Visio** | .vsd, .vsdx, .vss, .vst, .vsx, .vtx, .vdw, .vdx |
| **OpenDocument** | .odt, .ott, .ods, .odp, .odf, .odg |
| **Apple iWork** | .pages, .numbers, .key (US accounts only) |
| **Fixed Layout** | .pdf, .xps |
| **Images** | .bmp, .gif, .jpg, .jpeg, .png, .svg, .tif, .tiff, .ico |
| **Web** | .html, .htm, .mht (text only, no rendering) |
| **Text** | .txt, .csv |
| **Other** | .psd (Photoshop) |

### Document Conversion
**Evidence Level**: DOCUMENTED

**Process**:
1. User uploads document to Canvas
2. DocViewer retrieves document from URL
3. Document is converted to PDF using GroupDocs or LibreOffice converters
4. Converted PDF is stored on Amazon S3
5. All subsequent views use the converted PDF, not the original

**Converters**:
- **Primary**: GroupDocs (standard converter)
- **Fallback**: LibreOffice (can be requested for failed conversions)

**Source**: [DocViewer API - Using the Client](https://canvadocs.instructure.com/docs/docs/loadInIframe.html)

### Size and Page Limits
**Evidence Level**: DOCUMENTED

| Limit Type | Constraint | Behavior |
|------------|------------|----------|
| **Maximum File Size** | 100 MB | Files over 100 MB will not be converted |
| **Download Warning Threshold** | 30 MB | Warning displayed but file still viewable if under 100 MB |
| **Maximum Pages** | 999 pages | Documents exceeding 999 pages not supported |
| **Password-Protected** | Not supported | Password-protected files will not be converted |

**Processing Time**: Up to 10 minutes after submission for document conversion

**Sources**: 
- [Canvas Community - File Types](https://community.instructure.com/en/kb/articles/662858-what-types-of-files-can-i-preview-in-canvas)
- [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

### Format-Specific Limitations
**Evidence Level**: DOCUMENTED

1. **Text Files (.txt)**
   - HTML within text files cannot be previewed or annotated
   - Must be downloaded to view HTML content

2. **PowerPoint Files (.ppt/.pptx)**
   - Audio, transitions, animations, and embedded video not previewed
   - Must be downloaded to view multimedia content

3. **OpenDocument Files (.ods/.odt)**
   - Cannot be previewed in Canvas Teacher/Student mobile apps
   - Require third-party app on mobile devices

4. **Image Files (.tif/.tiff)**
   - Not natively supported by most browsers
   - May not preview in Canvas

5. **Apple iWork Files (.pages, .numbers, .key)**
   - Only available for Canvas accounts in the United States

**Source**: [Canvas Community - File Types](https://community.instructure.com/en/kb/articles/662858-what-types-of-files-can-i-preview-in-canvas)

---

## Document Rendering

### Rendering Engine
**Evidence Level**: DOCUMENTED

**Primary Renderer**: PDF.js (Mozilla's PDF rendering library)
- Specified in API calls as `"preferred_plugin": "pdfjs"`
- All documents converted to PDF before rendering
- Client-side rendering in browser

**Source**: [DocViewer API - Create Document](https://canvadocs.instructure.com/docs/docs/loadInIframe.html)

### Preview States
**Evidence Level**: DOCUMENTED

| State | Message | Meaning |
|-------|---------|---------|
| **Processing** | "Document is still processing" | Conversion in progress (up to 10 minutes) |
| **Ready** | Document displays | Conversion complete, ready for viewing |
| **Failed** | No preview available | Conversion failed, requires download |
| **Unsupported** | Preview button vs View Feedback | Format not DocViewer-compatible |

---

## Viewer Controls

### Toolbar Features
**Evidence Level**: DOCUMENTED

**Source**: [Canvas Community - DocViewer Toolbar](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

| Control | Function | Notes |
|---------|----------|-------|
| **Download** | Download annotated PDF | Includes all annotations and comments |
| **Page Navigation** | Navigate between pages | Text field for page number + arrow buttons |
| **Rotate** | Rotate page 90° clockwise | Cannot rotate pages with annotations; rotated pages cannot be annotated |
| **Zoom In/Out** | Zoom controls | Zoom buttons for magnification control |
| **Full Screen** | Toggle full screen mode | Expands viewer to full screen |
| **Annotation Tools** | Select annotation type | 6 annotation types available |

### Page Navigation
**Evidence Level**: DOCUMENTED

**Methods**:
1. Page number text field (direct entry)
2. Arrow buttons (previous/next)
3. Current page indicator shows: `[current] / [total]`

**Behavior**: Multi-page documents show page field; single-page documents hide navigation

### Zoom Functionality
**Evidence Level**: DOCUMENTED

**Features**:
- Zoom in/out buttons
- Annotations maintain accurate positioning across zoom levels
- Text selection works at all zoom levels

**Evidence Level**: INFERRED (coordinate system suggests zoom independence)

### Rotation
**Evidence Level**: DOCUMENTED

**Behavior**:
- Rotates current page 90° clockwise per click
- **Critical Constraint**: Pages with annotations cannot be rotated
- **Critical Constraint**: Rotated pages cannot be annotated
- Prevents annotation misalignment when rotation is reset
- Annotations automatically re-enabled when document returns to normal orientation

**Source**: [Canvas Community - DocViewer Toolbar](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

### Full Screen Mode
**Evidence Level**: DOCUMENTED

**Behavior**:
- Expands viewer to browser full screen
- All annotation tools remain functional
- Exit with button or ESC key

---

## Annotation Types

### Overview
**Evidence Level**: DOCUMENTED

**Source**: [Types of Annotations - DocViewer API](https://canvadocs.instructure.com/docs/docs/annotationTypes.html) (referenced in search results)

Canvas DocViewer supports **6 annotation types** plus comments:

1. **Point** - Pin marker at specific location
2. **Area** - Rectangle/box around region
3. **Highlight** - Text highlighting
4. **Strikeout** - Strikethrough text
5. **Free Draw** - Freehand drawing
6. **Free Text** - Text box annotation

---

### 1. Point Annotation

**Evidence Level**: DOCUMENTED

**Description**: Click-to-place pin marker for location-specific comments

**Creation Process**:
1. Select Point annotation tool
2. Choose color from color panel
3. Click desired location in document
4. Point marker icon appears at location
5. Add optional comment in comment field
6. Press Enter/Return to submit comment (Shift+Enter for new line)

**Properties**:
- Color selection (multiple colors available)
- Associated comments
- Movable (click and drag to reposition)
- Comment replies supported

**Editing**:
- **Move**: Hover over point icon, click and drag to new location
- **Delete**: Click annotation, click Delete icon, confirm deletion
- **Comment**: Click Reply button to add replies

**Use Cases**: 
- Pointing to specific elements in diagrams
- Marking precise locations
- Indicating citation placement

**Source**: [Canvas Community - Point Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

---

### 2. Area Annotation

**Evidence Level**: DOCUMENTED

**Description**: Rectangular box to frame text blocks or document regions

**Creation Process**:
1. Select Area annotation tool
2. Choose color from color panel
3. Click and drag to create rectangle
4. Box displays around selected area
5. Add optional comment

**Properties**:
- Color selection
- Resizable rectangle
- Associated comments
- Comment replies supported

**Use Cases**:
- Framing paragraphs or text blocks
- Highlighting sections of interest
- Drawing attention to specific areas

**Source**: [UW-Extension DocViewer Tip Sheet](https://id.uwex.edu/tip-sheets/DocViewer.pdf)

---

### 3. Highlight Annotation

**Evidence Level**: DOCUMENTED

**Description**: Highlight text within document with colored overlay

**Creation Process**:
1. Select Highlight annotation tool
2. Choose color from color panel
3. Click and drag to highlight text
4. Highlighted text displays with selected color
5. Click Comment button to add optional comment
6. Press Enter/Return to submit comment

**Properties**:
- Color selection (multiple colors)
- Text-based selection (follows text flow)
- Coordinates define corner points per section
- Associated comments
- Comment replies supported

**Editing**:
- **Delete**: Click highlighted area, click Delete icon, confirm deletion
- Deleting annotation also deletes associated comments

**Technical Details** (Evidence Level: DOCUMENTED):
```
Type: "highlight"
Coords: Array of corner coordinates for each section/rectangle
  - Coordinates for each corner of each section
  - Origin: upper-left corner of document
Color: Hex color value
```

**Use Cases**:
- Marking important passages
- Indicating errors or issues
- Quick feedback annotations (e.g., "citation needed", "delete")

**Source**: [Canvas Community - Highlight Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

---

### 4. Strikeout Annotation

**Evidence Level**: DOCUMENTED

**Description**: Strike through text to indicate deletion

**Creation Process**:
1. Select Strikeout annotation tool
2. Choose color from color panel
3. Click and drag over text to strike out
4. Line appears through selected text
5. Click Comment button to add optional comment
6. Press Enter/Return to submit comment

**Properties**:
- Color selection
- Text-based selection
- Coordinates define bounding box around strikeout sections
- Associated comments
- Comment replies supported

**Technical Details** (Evidence Level: DOCUMENTED):
```
Type: "strikeout"
Coords: Bounding box coordinates for each section
  - Origin: upper-left corner of document
Color: Hex color value
```

**Use Cases**:
- Marking text for deletion
- Indicating unnecessary content
- Editorial corrections

**Source**: [Canvas Community - Strikeout Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

---

### 5. Free Draw Annotation

**Evidence Level**: DOCUMENTED

**Description**: Freehand drawing with pen/stylus/mouse for custom shapes and marks

**Creation Process**:
1. Select Free Draw annotation tool
2. Choose color from color panel
3. Select line width from width panel
4. Click and drag to draw
5. Free-form lines appear
6. Multiple strokes can be added to single annotation
7. Click Check icon to accept drawing
8. Add optional comment

**Properties**:
- Color selection
- Line width selection (per annotation, not per stroke)
- Multiple strokes per annotation
- Ink strokes stored as point lists with location, width, opacity
- Associated comments
- Movable (hover over outline, drag to reposition)

**Editing**:
- **Move**: Hover over drawing outline, click and drag to new location
- **Delete**: Click drawing, click Delete icon, confirm deletion
- Deleting annotation also deletes associated comments

**Technical Details** (Evidence Level: DOCUMENTED):
```
Type: "free draw"
Data: Ink strokes as point lists
  - Each point: location, width, opacity
  - Multiple strokes per annotation
Line Width: Must be saved before creating new line with different width
```

**Use Cases**:
- Circling sections
- Drawing arrows or connectors
- Creating custom shapes
- Suggesting formatting changes

**Limitations**:
- One line width per annotation
- Individual annotations must be saved before creating new line with different width

**Source**: 
- [Canvas Community - Draw Annotations](https://community.instructure.com/en/kb/articles/661230-how-do-i-use-docviewer-in-canvas-assignments-as-a-student)
- [UW-Extension DocViewer Tip Sheet](https://id.uwex.edu/tip-sheets/DocViewer.pdf)

---

### 6. Free Text Annotation

**Evidence Level**: DOCUMENTED

**Description**: Text box placed anywhere in document for direct text comments

**Creation Process**:
1. Select Free Text annotation tool
2. Choose color from color panel
3. Select background type (transparent or white)
4. Select font size
5. Click desired location in document
6. Type text entry
7. Press Shift+Enter for new line within text box

**Properties**:
- Text color selection
- Background: transparent or white
- Font size selection
- Movable text box
- No separate comment field (text is the annotation)

**Editing**:
- **Move**: Hover over text box, click and drag to new location
- **Delete**: Click text box, click Delete icon, confirm deletion

**Use Cases**:
- Marginal comments
- General holistic feedback
- Inline suggestions

**Source**: [Canvas Community - Text Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

---

## Annotation Properties

### Color Selection
**Evidence Level**: DOCUMENTED

**Feature**: Color panel available for all annotation types
**Colors Available**: Multiple colors (specific palette not documented)
**Persistence**: Mobile app retains selected color across submissions

**Source**: [Canvas Community - Android DocViewer](https://community.instructure.com/en/kb/articles/661890-how-do-i-add-docviewer-annotations-in-the-teacher-app-on-my-android-device)

### Line Width (Drawing Only)
**Evidence Level**: DOCUMENTED

**Feature**: Line width panel for Free Draw annotations
**Options**: Multiple width options (specific values not documented)
**Limitation**: One width per annotation; must save before changing width

### Text Properties (Free Text Only)
**Evidence Level**: DOCUMENTED

**Font Size**: Multiple size options available
**Background**: Choice of transparent or white background
**Color**: Text color selection from color panel

### Opacity
**Evidence Level**: DOCUMENTED

**Highlight**: Has opacity/transparency (implied by term "highlight")
**Free Draw**: Opacity stored per point in ink strokes

**Source**: [Types of Annotations - DocViewer API](https://canvadocs.instructure.com/docs/docs/annotationTypes.html) (referenced)

---

## Comment System

### Comment Structure
**Evidence Level**: DOCUMENTED

**Attachment**: Comments can be attached to most annotation types:
- Point annotations
- Area annotations
- Highlight annotations
- Strikeout annotations
- Free Draw annotations
- Free Text annotations (text itself is the content)

**Comment Features**:
- Rich text entry
- Multi-line support (Shift+Enter for new line)
- Submit with Enter/Return key
- Comment button to add/view comments
- Ellipsis link for expanded view of long comments

### Comment Threads and Replies
**Evidence Level**: DOCUMENTED

**Features**:
- **Replies**: Users can reply to existing comments
- **Threading**: Comments show stacked/nested replies
- **Reply Button**: Visible on comments to add replies
- **Expand**: Click comment to expand and view all replies
- **Student Replies**: Students can reply to instructor comments in DocViewer

**Reply Workflow**:
1. Click on annotation with comment
2. Click Reply button
3. Type reply
4. Press Enter/Return to submit

**Source**: 
- [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)
- [Canvas Community - View Feedback](https://community.instructure.com/en/kb/articles/661231-how-do-i-view-annotation-feedback-comments-from-my-instructor-directly-in-my-assignment-submission)

### Comment Visibility
**Evidence Level**: DOCUMENTED

**General Behavior**:
- Comments display with annotation
- Author name shown (except in anonymous mode)
- Comment text visible
- Reply comments shown in thread

**Expanded View**:
- Full screen icon available
- Shows all comments and threads
- Better readability for long discussions

**Source**: [Canvas Community - View Feedback](https://community.instructure.com/en/kb/articles/661231-how-do-i-view-annotation-feedback-comments-from-my-instructor-directly-in-my-assignment-submission)

---

## Annotation Persistence

### Autosave Behavior
**Evidence Level**: DOCUMENTED

**Session-Based Autosave**:
- **Desktop/Web**: Annotations auto-saved during 10-hour session
- **Mobile**: Annotations auto-saved for 1 hour
- **Requirement**: Annotations must be submitted/accepted before session expires
- Unsubmitted annotations lost at session expiration
- Submitted annotations persist regardless of session

**Session Refresh**:
- Can restart session anytime by refreshing page
- Preserves submitted annotations
- Clears unsaved annotation work

**Source**: 
- [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)
- [Canvas Community - Mobile DocViewer](https://community.instructure.com/en/kb/articles/661839-how-do-i-add-docviewer-annotations-in-the-teacher-app-on-my-ios-device)

### Storage and Sync
**Evidence Level**: DOCUMENTED

**Synchronization**:
- Mobile annotations sync with web SpeedGrader
- Cross-platform annotation persistence
- Same annotation set visible across devices

**Storage** (Evidence Level: INFERRED):
- Annotations stored server-side
- Retrieved via JWT session
- Associated with document_id and annotation_context

**Source**: [Canvas Community - Mobile DocViewer](https://community.instructure.com/en/kb/articles/661839-how-do-i-add-docviewer-annotations-in-the-teacher-app-on-my-ios-device)

### Annotation Deletion
**Evidence Level**: DOCUMENTED

**Process**:
1. Click annotation to select
2. Click Delete icon
3. Confirmation prompt displays
4. Confirm deletion
5. Annotation and all associated comments permanently deleted

**Cascade Behavior**: Deleting annotation also deletes all comments and replies

**Source**: [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

---

## Coordinate System

### Annotation Positioning
**Evidence Level**: DOCUMENTED

**Source**: [Types of Annotations - DocViewer API](https://canvadocs.instructure.com/docs/docs/annotationTypes.html) (referenced in search results)

**Coordinate Origin**: Upper-left corner of document

**Common Properties**:
```javascript
{
  page: 0,  // Zero-indexed page number
  rect: {   // Physical space occupied (not for comments)
    // Origin: upper-left corner
    // Exact structure not fully documented
  }
}
```

### Annotation Type Specifics

**Point Annotations**:
```javascript
{
  type: "point",
  page: 0,        // Zero-indexed
  rect: {...},    // Physical location
  color: "#hex"
}
```

**Area Annotations**:
```javascript
{
  type: "square",
  page: 0,
  rect: {...},    // Rectangle bounds
  color: "#hex"
}
```

**Highlight Annotations**:
```javascript
{
  type: "highlight",
  page: 0,
  coords: [...],  // Corner coordinates for each section
                  // Origin: upper-left corner
  color: "#hex"
}
```

**Strikeout Annotations**:
```javascript
{
  type: "strikeout",
  page: 0,
  coords: [...],  // Bounding box coordinates
  color: "#hex"
}
```

**Free Draw Annotations**:
```javascript
{
  type: "free draw",
  page: 0,
  ink: [...],     // Point lists with location, width, opacity
  color: "#hex"
}
```

### Coordinate Accuracy
**Evidence Level**: INFERRED

**Zoom Independence**: 
- Annotations maintain position across zoom levels
- Suggests normalized or resolution-independent coordinates
- Likely percentage-based or PDF point-based system

**Rotation Constraint**:
- Cannot annotate rotated pages
- Cannot rotate annotated pages
- Prevents coordinate misalignment issues

---

## Draft vs Published Workflow

### Draft Comments (SpeedGrader Context)
**Evidence Level**: DOCUMENTED

**Source**: [Canvas Community - Feedback Comments](https://community.instructure.com/en/kb/articles/664292-how-do-i-leave-feedback-comments-for-student-submissions-in-speedgrader)

**Assignment Comments** (not DocViewer annotations):
- Comments must be manually submitted
- Unsaved comments show "Draft" pill indicator
- Draft comments have colored background
- Submit button required to publish comments
- Warning displayed if navigating away with unsaved comment

**Draft Behavior**:
1. Enter comment text
2. Navigate away triggers warning
3. Click "Proceed" to save as draft
4. Draft preserved when returning to submission
5. Submit or Delete buttons available for draft

**Draft Storage**:
- Saved per-submission
- Per-browser storage
- Retrieved when returning to submission

**Student Visibility**:
- Students cannot see draft comments
- Only submitted comments visible to students

### Grade Posting Policy
**Evidence Level**: DOCUMENTED

**Source**: [Canvas Community - Managing Grades Release](https://www.elearning.fse.manchester.ac.uk/getting-started-with-canvas/managing-the-release-of-grades/)

**Posting Policies**:

1. **Automatic Posting**:
   - Grades and comments immediately visible to students
   - Default for some institutions

2. **Manual Posting**:
   - Grades and comments hidden until explicitly posted
   - Instructor must click "Post Grades"
   - Prevents accidental early release
   - Allows time for moderation

**Posting Options**:
- **Everyone**: Current and future grades/comments shown immediately
- **Graded**: Only current grades/comments shown; future still hidden
- **Specific Sections**: Post to selected sections only

**Access Location**:
- Post from SpeedGrader (eye icon in upper left)
- Post from Gradebook

**Important**: Even with manual policy, individual quiz settings can override and show immediate results

### DocViewer Annotations in Context
**Evidence Level**: DOCUMENTED

**Annotations Behavior**:
- DocViewer annotations submitted immediately when accepted
- Saved server-side with session
- Affected by grade posting policy for student visibility
- Students cannot see annotations until grades posted (if manual policy)

**Anonymous Grading**:
- If assignment anonymously graded, annotations not visible until unmuted/posted
- DocViewer does not support anonymous comments for peer review

**Source**: 
- [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)
- [Post Grades - Stanford](https://canvashelp.stanford.edu/hc/en-us/articles/360043729773-Post-grades-comments-within-SpeedGrader)

---

## Permissions & Visibility

### Instructor Permissions
**Evidence Level**: DOCUMENTED

**Annotation Capabilities**:
- Create all annotation types
- Edit own annotations
- Delete own annotations
- Delete any student comment or annotation at any time
- View all annotations

**Grade Posting**:
- Requires "Grades - edit" permission to post/hide grades
- Requires "Grades - view audit trail" to view grading history

**Source**: 
- [Canvas Community - DocViewer Student View](https://community.instructure.com/en/kb/articles/661230-how-do-i-use-docviewer-in-canvas-assignments-as-a-student)
- [Instructure Permissions - View Audit Trail](https://developerdocs.instructure.com/services/canvas/permissions/details/file.permissions_view_audit_trail)

### Student Permissions
**Evidence Level**: DOCUMENTED

**Annotation Capabilities** (if enabled by institution):
- Can use all annotation types on own submissions
- Can reply to instructor comments
- Can view instructor annotations (after grades posted)
- Cannot edit or delete instructor annotations
- Can delete own annotations
- May be restricted from annotating (institutional setting)

**Visibility Rules**:
- See own submission
- See instructor feedback only after grades posted (manual policy)
- View feedback link shows indicator when annotated comments present
- Cannot see annotations if assignment anonymously graded until unmuted

**Source**: [Canvas Community - DocViewer Student View](https://community.instructure.com/en/kb/articles/661230-how-do-i-use-docviewer-in-canvas-assignments-as-a-student)

### Peer Review Permissions
**Evidence Level**: DOCUMENTED

**Peer Review Annotations**:
- Students can annotate peer submissions (if enabled)
- Anonymous peer reviews not supported in DocViewer
- DocViewer does not support anonymous comments

**Source**: [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

### Anonymous Grading
**Evidence Level**: DOCUMENTED

**Behavior**:
- Students view annotations in orientation selected by grader
- Annotations not available until assignment unmuted/posted
- DocViewer annotations cannot be anonymous for comments
- Author name hidden when anonymous

**Source**: [Canvas Community - DocViewer Student View](https://community.instructure.com/en/kb/articles/661230-how-do-i-use-docviewer-in-canvas-assignments-as-a-student)

### Institutional Restrictions
**Evidence Level**: DOCUMENTED

**Feature Toggle**:
- Institutions can disable annotation features
- Students may not be able to annotate even if feature exists
- Message displays if feature restricted

---

## Export Functionality

### Download Annotated PDF
**Evidence Level**: DOCUMENTED

**Feature**: Download button in DocViewer toolbar

**Behavior**:
- Downloads PDF with all annotations and comments rendered
- Preserves visual representation of annotations
- Comments included in downloaded file
- Available to both instructors and students (if permitted)

**File Format**: PDF with annotations embedded

**Viewing Downloaded File**:
- Can view in browser
- Adobe Acrobat Reader recommended for optimal display
- Settings required to view/print vary by software
- Some browsers may not render comments correctly initially

**Source**: 
- [Canvas Community - DocViewer Toolbar](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)
- [Canvas Community - View Feedback](https://community.instructure.com/en/kb/articles/661231-how-do-i-view-annotation-feedback-comments-from-my-instructor-directly-in-my-assignment-submission)

### Original Document Download
**Evidence Level**: INFERRED

**Assumption**: Original uploaded document likely available for download separately from annotated PDF
**Confirmation**: Not explicitly documented in research

---

## Keyboard Shortcuts & Accessibility

### Keyboard Shortcuts
**Evidence Level**: DOCUMENTED

**Source**: 
- [Canvas Keyboard Shortcuts - Illinois](https://answers.uillinois.edu/illinois/115004)
- [Canvas Keyboard Shortcuts PDF - Colorado](https://www.colorado.edu/learningdesign/sites/default/files/attached-files/canvas_keyboard_shortcuts.pdf)

**SpeedGrader Shortcuts** (DocViewer is embedded in SpeedGrader):

| Key | Action |
|-----|--------|
| `j` | Next student |
| `k` | Previous student |
| `c` | Leave comment |
| `g` | Change grade |
| `r` | Use rubric |
| `Home` | First student |
| `End` | Last student |
| `Shift+?` | View keyboard shortcuts help |

**Requirements**:
- Shortcuts only work when submission panel has focus
- Must click outside text fields before using shortcuts
- Can be disabled in User Settings > Feature Settings

**DocViewer-Specific Shortcuts**:
- Not explicitly documented for annotation tools
- Standard browser shortcuts likely apply (Ctrl+Z for undo, etc.)

### Accessibility Features
**Evidence Level**: DOCUMENTED

**Source**: 
- [Canvas Accessibility Standards](https://community.instructure.com/en/kb/articles/662723-what-are-the-canvas-accessibility-standards)
- [Canvas Accessibility Options - UMSystem](https://tdx.umsystem.edu/TDClient/66/MOOnline/KB/Article/539/Canvas-accessibility-options)

**Screen Reader Support**:

Officially supported combinations:
- **JAWS** (latest) with Chrome/Firefox on Windows
- **NVDA** (latest) with Chrome/Firefox on Windows
- **VoiceOver** (latest) with Safari/Chrome on macOS and iOS
- **TalkBack** (latest) with Android mobile

**DocViewer Accessibility**:
- Annotations and comments accessible with screen reader
- Reads: annotation type, author name, comment text, reply comments
- Annotations read at end of document

**Accessibility Limitations** (Evidence Level: DOCUMENTED):
1. No indication that comment is available while listening to document
2. Cannot jump from comment to associated annotation location when tabbing
3. Annotation type not indicated inline
4. Some images may lack alt text
5. Markers not in-line with text

**ARIA Support**:
- Canvas uses ARIA landmark regions extensively
- Navigate via regions for best experience
- HTML headings used within regions

**Additional Features**:
- High Contrast UI available
- Underlined links option
- Keyboard shortcut disable option in User Settings
- Move-to option for drag-and-drop alternatives

**Source**: [Canvas Accessibility Standards](https://community.instructure.com/en/kb/articles/662723-what-are-the-canvas-accessibility-standards)

---

## Mobile Support

### Canvas Teacher App
**Evidence Level**: DOCUMENTED

**Platform Support**:
- iOS (iPhone and iPad)
- Android (phone and tablet)

**DocViewer Integration**:
- Full DocViewer annotation support in Teacher app
- Annotations sync with web SpeedGrader
- All 6 annotation types available
- Touch input support (finger or stylus on ChromeOS)

**Source**: 
- [Canvas Community - iOS DocViewer](https://community.instructure.com/en/kb/articles/661839-how-do-i-add-docviewer-annotations-in-the-teacher-app-on-my-ios-device)
- [Canvas Community - Android DocViewer](https://community.instructure.com/en/kb/articles/661890-how-do-i-add-docviewer-annotations-in-the-teacher-app-on-my-android-device)

### Mobile Toolbar
**Evidence Level**: DOCUMENTED

**Features**:
- Toolbar at top of document
- 6 annotation type icons
- Color selection panel
- Line width selection (for drawing)
- Grab annotation icon (pan mode)
- Hide/show toolbar button
- Undo/Redo buttons (tap or tap-and-hold)

**Interface Differences**:
- Tap annotation icon to select (white background when selected)
- Tap again to deselect
- Hold Text icon to reveal Point option
- Hold Drawing icon to reveal Area option
- Swipe up to view multiple pages
- Swipe left/right to move between students

### Mobile Session Duration
**Evidence Level**: DOCUMENTED

**Session Management**:
- 1-hour autosave session (vs 10 hours on desktop)
- Can refresh session anytime
- Submitted annotations persist beyond session

**Color Persistence** (Android):
- Selected annotation color retained across submissions
- Persists until different color selected

### Mobile Limitations
**Evidence Level**: DOCUMENTED

**OpenDocument Files**:
- .ods/.odt cannot be previewed in Canvas mobile apps
- Requires third-party app on device
- Available on desktop/web

**Touch Input**:
- Touch input (finger) or stylus supported on ChromeOS devices
- Full annotation capability with touch

**Source**: [Canvas Community - DocViewer Student View](https://community.instructure.com/en/kb/articles/661230-how-do-i-use-docviewer-in-canvas-assignments-as-a-student)

---

## Session Management

### Session Duration
**Evidence Level**: DOCUMENTED

**Desktop/Web Sessions**:
- **Duration**: 10 hours
- **Start**: When submission opened
- **Expiration Warnings**: 
  - 9 hours 50 minutes (10-minute warning)
  - 5-minute warning
  - 1-minute warning
- **Behavior**: Unsaved annotations lost at expiration; submitted annotations safe

**Mobile Sessions**:
- **Duration**: 1 hour
- **Same warning system** (proportional timing)

**Session Refresh**:
- Refresh page to restart session anytime
- Preserves submitted annotations
- Clears work-in-progress annotations

**Source**: 
- [Canvas Community - DocViewer Annotations](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)
- [Canvas Community - Mobile DocViewer](https://community.instructure.com/en/kb/articles/661839-how-do-i-add-docviewer-annotations-in-the-teacher-app-on-my-ios-device)

### Session Creation (API)
**Evidence Level**: DOCUMENTED

**Source**: [DocViewer API - Sessions](https://canvadocs.instructure.com/docs/docs/loadInIframe.html)

**Endpoint**: `POST /1/sessions`

**Parameters**:
```javascript
{
  "document_id": "string",          // Document ID from document creation
  "render_id": "string",            // Document ID + renderer plugin
  "render_plugin": "pdfjs",         // Rendering engine
  "duration": 10080,                // Session duration in minutes (7 days default)
  "annotation_context": "string",   // Context for annotation segregation
  "permissions": "readwrite",       // Session type
  "user_id": "string",              // User identifier
  "user_name": "string",            // Display name
  "user_role": "string"             // User role
}
```

**Returns**: JWT session ID (very long token)

**Session Types** (Evidence Level: DOCUMENTED):
1. **Annotations Disabled Mode**: No annotation capability
2. **Readonly Mode**: View only
3. **Readwrite Mode**: Full annotation capability
4. **Manage Mode**: Administrative capabilities

### Session Security
**Evidence Level**: DOCUMENTED

**JWT Token**:
- Session credentials passed as JWT
- Contains all information DocViewer needs
- Passed in iframe URL: `/1/sessions/{SESSION_ID}/view`
- Time-limited (duration specified at creation)

---

## Error Handling & Edge Cases

### File Processing Errors
**Evidence Level**: DOCUMENTED

**"Still Processing" Message**:
- Displayed when conversion incomplete
- Can take up to 10 minutes
- User should wait and refresh

**Conversion Failure**:
- File does not display in DocViewer
- Preview button may not appear
- User must download file to view

**Troubleshooting** (Evidence Level: DOCUMENTED):
- Try uploading as different file type
- Check file size (under 100 MB)
- Verify file not password-protected
- Confirm format is supported

**Source**: [Canvas Community - File Types](https://community.instructure.com/en/kb/articles/662858-what-types-of-files-can-i-preview-in-canvas)

### Re-rendering Failed Conversions
**Evidence Level**: DOCUMENTED

**Source**: [DocViewer Admin Panel](https://canvadocs.instructure.com/docs/docs/adminui.html)

**Admin Capabilities**:
- Search by Document ID
- Click "Rerender" button
- Option: "Rerender with LibreOffice" (if GroupDocs failed)
- Update source URL if original expired

**API Re-rendering**:
- Endpoint: `POST /1/documents/{document_id}/retry?plugin=pdfjs`
- Useful for batch re-rendering

### File Size Warnings
**Evidence Level**: DOCUMENTED

**30 MB Warning**:
- Warning message displays for files over 30 MB
- "Older hardware or slower connections may struggle"
- Message can be safely dismissed
- File still displays if under 100 MB limit

**100 MB Hard Limit**:
- Files over 100 MB will not convert
- No DocViewer preview available
- Must download to view

**Source**: [DocViewer Service Management - USF](https://usfjira.atlassian.net/wiki/spaces/SM/pages/10397157243/DocViewer)

### Password-Protected Files
**Evidence Level**: DOCUMENTED

**Behavior**:
- Will not be converted by DocViewer
- No preview available
- Must download original file

### Session Expiration
**Evidence Level**: DOCUMENTED

**Behavior**:
- Warnings at 9:50, 5 minutes, 1 minute
- Unsaved annotations lost at expiration
- Submitted annotations preserved
- Can refresh to restart session

**Prevention**:
- Submit annotations as you work
- Refresh periodically for long sessions
- Monitor time warnings

### Browser Compatibility
**Evidence Level**: DOCUMENTED

**PDF Viewer Conflict**:
- If browser has built-in PDF viewer, may interfere
- Select option to view in system viewer
- Affects comment rendering

**Rendering Issues**:
- Some browsers may not initially render comments correctly
- Download PDF to view with Adobe Acrobat Reader
- Settings vary by software for viewing/printing annotations

**Source**: [Canvas Community - View Feedback](https://community.instructure.com/en/kb/articles/661231-how-do-i-view-annotation-feedback-comments-from-my-instructor-directly-in-my-assignment-submission)

### Rotation and Annotation Conflicts
**Evidence Level**: DOCUMENTED

**Critical Constraints**:
1. Pages with annotations cannot be rotated
2. Rotated pages cannot be annotated
3. Attempting to annotate rotated page: no marks appear
4. Annotations auto-re-enabled when rotation reset
5. Intentional design to prevent misalignment

**Source**: [Canvas Community - DocViewer Toolbar](https://community.instructure.com/en/kb/articles/664279-how-do-i-add-annotated-comments-in-student-submissions-using-docviewer-in-speedgrader)

### Unsupported Content
**Evidence Level**: DOCUMENTED

**Text Files**:
- HTML within .txt cannot be previewed/annotated
- Must download to view

**PowerPoint**:
- Audio, transitions, animations, video not previewed
- Must download to view multimedia

**Text Entry Assignments**:
- Annotation tools not available
- Cannot use DocViewer on text entries

---

## API Integration

### Document Creation
**Evidence Level**: DOCUMENTED

**Source**: [DocViewer API - Documents](https://canvadocs.instructure.com/docs/docs/loadInIframe.html)

**Endpoint**: `POST /1/documents`

**Request**:
```javascript
POST http://canvadocs.docker/1/documents

Content-Type: application/json
Authorization: Token <apikey>

{
  "name": "test.pdf",
  "preferred_plugin": "pdfjs",
  "url": "http://www.example.com/test.pdf"
}
```

**Response**:
```javascript
{
  "id": "string",                    // Document ID (save this)
  "user_id": "string",
  "name": "string",
  "pdf_url": "string",               // Location of converted PDF
  "source_url": "string",            // Original document location
  "renders": [{
    "id": "string",
    "plugin": "pdfjs",
    "status": "pending|done|error|deleted",
    "started_at": "ISO 8601",
    "created_at": number
  }],
  "created_at": "ISO 8601"
}
```

**Important**: 
- Returns before conversion complete
- Status initially "queued" or "pending"
- Poll or wait for "done" status

### Session Creation
**Evidence Level**: DOCUMENTED

**Endpoint**: `POST /1/sessions`

**Request**:
```javascript
POST http://canvadocs.docker/1/sessions

Content-Type: application/json; charset=utf-8
Authorization: Token <apikey>

{
  "document_id": "<DOCUMENT_ID>",
  "render_id": "<DOCUMENT_ID>-pdfjs",
  "render_plugin": "pdfjs",
  "duration": 10080,
  "annotation_context": "canvadocs_admin",
  "permissions": "readwrite",
  "user_id": "standard_user",
  "user_name": "Standard User",
  "user_role": "user-role"
}
```

**Response**: JWT session ID (long token string)

### Loading DocViewer
**Evidence Level**: DOCUMENTED

**Method**: Iframe embed

**URL**: `/1/sessions/{SESSION_ID}/view`

**Example**:
```html
<iframe 
  src="http://canvadocs.docker/1/sessions/SESSION_ID/view" 
  allowfullscreen="1">
</iframe>
```

**Session ID**: Very long JWT from session creation

### Document Download
**Evidence Level**: DOCUMENTED

**Endpoint**: `GET /1/sessions/{session_id}/file/{filename}`

**Purpose**: Downloads converted PDF for client display

**Parameters**:
- `session_id`: JWT session token
- `filename`: Name property from Document Object

**Returns**: PDF file (200 OK)

### Annotation Storage
**Evidence Level**: INFERRED

**Storage**: Server-side via DocViewer API
**Retrieval**: Via annotation_context in session
**Structure**: JSON objects with type, page, coordinates, properties

**Evidence**: API documentation references and search results indicate server-side storage, but specific annotation CRUD endpoints not fully documented in accessible documentation.

---

## Known Limitations

### File Limitations
**Evidence Level**: DOCUMENTED

1. **Maximum size**: 100 MB (hard limit)
2. **Maximum pages**: 999 pages
3. **Password-protected files**: Not supported
4. **Processing time**: Up to 10 minutes
5. **30 MB threshold**: Performance warning

### Format-Specific Limitations
**Evidence Level**: DOCUMENTED

1. **HTML in .txt files**: Cannot preview or annotate
2. **PowerPoint multimedia**: Audio, transitions, animations, video not previewed
3. **.tif/.tiff images**: Not natively supported by most browsers
4. **OpenDocument mobile**: .ods/.odt not previewable in mobile apps
5. **iWork files**: US accounts only

### Annotation Limitations
**Evidence Level**: DOCUMENTED

1. **Rotation conflict**: Cannot rotate annotated pages; cannot annotate rotated pages
2. **Text entry assignments**: Annotation tools not available
3. **Anonymous peer review**: DocViewer doesn't support anonymous comments
4. **Drawing line width**: One width per annotation
5. **Session expiration**: Unsaved annotations lost

### Accessibility Limitations
**Evidence Level**: DOCUMENTED

1. No inline indication of comment availability for screen readers
2. Cannot jump from comment to annotation location when tabbing
3. Annotation type not indicated inline
4. Some images may lack alt text
5. Markers not in-line with text

### Concurrent Editing
**Evidence Level**: DOCUMENTED

**Issue**: DocViewer annotations generally safe for concurrent editing, but SpeedGrader context has limitations

**Safe for Concurrent Use**:
- Adding DocViewer annotations to same student submission
- Adding comments within document preview

**Not Safe** (data loss risk):
- Editing assignment rubric
- Editing overall assignment grade
- Editing quiz question scores/comments

**Recommendation**: Coordinate grading sessions or section-based assignment

**Source**: [Canvas Help - Avoid Data Loss - Stanford](https://canvashelp.stanford.edu/hc/en-us/articles/115007357988-Avoid-data-loss-when-multiple-graders-use-SpeedGrader)

### Performance Limitations
**Evidence Level**: DOCUMENTED

**SpeedGrader Context**:
- Large courses (>1500 submissions) may have delayed load times
- Very large courses (>2500 submissions) may fail to load
- Recommendation: Use section filters

**Source**: [Canvas Community - SpeedGrader](https://community.instructure.com/en/kb/articles/661158-how-do-i-use-speedgrader)

### Storage Limitations
**Evidence Level**: DOCUMENTED

**Grade History**: Only last 365 days retained

**Annotation History**: Retention period not explicitly documented (assumed indefinite while course active)

---

## Research Methodology

### Sources Used

**Official Documentation**:
1. Canvas Community Knowledge Base (Instructure)
2. DocViewer API Documentation (Instructure)
3. Canvas LMS GitHub Repository

**Educational Institution Resources**:
4. University/college Canvas guides and tip sheets
5. Academic technology center documentation

**Video Resources**:
6. YouTube tutorials and demonstrations

### Evidence Classification

**DOCUMENTED**: Information found in official Instructure documentation, API docs, or Canvas Community
- Highest confidence
- Direct from authoritative source

**OBSERVED**: Information described in educational guides based on actual usage
- High confidence
- Consistent across multiple independent sources

**INFERRED**: Logical conclusions based on documented behavior
- Medium confidence
- Reasonable assumptions from available evidence

**UNAVAILABLE**: Information explicitly identified as inaccessible
- Proprietary implementation details
- Internal algorithms
- Closed-source components

---

## Summary of Key Findings

### Core Capabilities
✅ 6 annotation types (Point, Area, Highlight, Strikeout, Free Draw, Free Text)
✅ Comment system with threading and replies
✅ Real-time autosave during session
✅ Cross-platform sync (web and mobile)
✅ Export to annotated PDF
✅ Accessibility support (screen readers, keyboard navigation)
✅ Mobile app support (iOS and Android)

### Technical Architecture
✅ PDF-based rendering (all formats converted to PDF)
✅ Client-side rendering with PDF.js
✅ Server-side annotation storage
✅ JWT-based session security
✅ Upper-left origin coordinate system
✅ Zero-indexed page numbering

### Critical Constraints
⚠️ Cannot rotate pages with annotations
⚠️ Cannot annotate rotated pages
⚠️ 100 MB file size limit
⚠️ 999 page limit
⚠️ 10-hour session duration
⚠️ Password-protected files not supported

### Implementation Insights
- Coordinate system: Upper-left origin, page-relative
- Annotation types use different coordinate structures (rect vs coords)
- Drawing annotations store ink strokes as point lists
- Session management critical for annotation persistence
- Grade posting policy controls student visibility

---

## Recommendations for MySL8TE Implementation

### Must-Have Features
1. All 6 annotation types
2. Comment threading and replies
3. Coordinate-accurate positioning system
4. Session-based autosave
5. Export to annotated PDF
6. Zoom-independent annotation rendering

### Should-Have Features
1. Mobile-responsive interface
2. Keyboard shortcuts
3. Accessibility support (ARIA, screen readers)
4. Draft/publish workflow
5. User permissions system

### Nice-to-Have Features
1. Color selection for annotations
2. Line width options for drawing
3. Undo/redo functionality
4. Full-screen mode
5. Page rotation (without annotations)

### Technical Considerations
1. Choose coordinate system carefully (normalized vs absolute)
2. Implement session expiration warnings
3. Handle concurrent editing scenarios
4. Consider PDF.js or similar rendering library
5. Plan for large file performance optimization

---

**Research Status**: COMPLETE  
**Next Steps**: Integrate findings into FEATURE_PARITY_MATRIX.md  
**Related Documents**: 
- CANVAS_SPEEDGRADER_RESEARCH.md (SpeedGrader integration)
- CANVAS_EVIDENCE.md (Source links and references)
