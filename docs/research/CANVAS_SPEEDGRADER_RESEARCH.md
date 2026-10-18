# Canvas SpeedGrader Research

**Status**: Complete  
**Date**: 2026-10-18  
**Research Agent**: Agent 1 - Canvas Reverse Engineering Specialist  
**Mission**: MySL8TE Feature Lab - Canvas SpeedGrader Investigation

---

## Executive Summary

Canvas SpeedGrader is Instructure's integrated grading interface that allows instructors to view, grade, and provide feedback on student assignment submissions. It combines document viewing (via DocViewer), rubric-based assessment, comment systems, and grade management in a unified workflow. This research documents all publicly observable features, behaviors, and workflows discovered through official documentation and community resources.

---

## Table of Contents

1. [SpeedGrader Overview](#speedgrader-overview)
2. [Submission Queue & Navigation](#submission-queue--navigation)
3. [Assignment Metadata Display](#assignment-metadata-display)
4. [Grade Entry Interface](#grade-entry-interface)
5. [Grading Rubrics System](#grading-rubrics-system)
6. [Comment System](#comment-system)
7. [DocViewer Integration](#docviewer-integration)
8. [Draft vs Published Feedback](#draft-vs-published-feedback)
9. [Publication Workflow](#publication-workflow)
10. [Student Visibility & Reply](#student-visibility--reply)
11. [Submission Version Handling](#submission-version-handling)
12. [Grading History & Audit Trails](#grading-history--audit-trails)
13. [Notification System](#notification-system)
14. [Downloadable Feedback](#downloadable-feedback)
15. [Permission Model](#permission-model)
16. [Keyboard Shortcuts](#keyboard-shortcuts)
17. [Mobile Support](#mobile-support)
18. [Performance & Scalability](#performance--scalability)
19. [Known Limitations](#known-limitations)

---

## SpeedGrader Overview

### Purpose and Scope
**Evidence Level**: DOCUMENTED

**Source**: [What is SpeedGrader?](https://community.instructure.com/en/kb/articles/662775-what-is-speedgrader)

**Description**: SpeedGrader is Canvas's integrated grading tool that enables instructors to:
- View and grade student assignment submissions in one interface
- Use simple point scales or complex rubrics for assessment
- Accept various document formats and URLs as submissions
- Mark up documents directly within submissions (via DocViewer)
- Provide text, audio, or video feedback comments
- Track grading progress
- Handle anonymous and moderated grading

### Access Methods
**Evidence Level**: DOCUMENTED

SpeedGrader can be accessed from multiple locations:

1. **From Assignments**: Click assignment → Options menu → SpeedGrader
2. **From Quizzes**: Click quiz → Options menu → SpeedGrader
3. **From Graded Discussions**: Click discussion → Options menu → SpeedGrader
4. **From Gradebook**: Hover over assignment column → click SpeedGrader icon

### Supported Assignment Types
**Evidence Level**: DOCUMENTED

- **File Upload**: Documents submitted by students
- **Text Entry**: Text submitted directly in Canvas
- **Website URL**: Links submitted by students
- **Media Recording**: Audio/video recordings
- **Quizzes**: Canvas quizzes (Classic and New Quizzes)
- **Graded Discussions**: Discussion posts
- **External Tools**: LTI tool assignments

---

## Submission Queue & Navigation

### Student List Navigation
**Evidence Level**: DOCUMENTED

**Source**: [How to Use SpeedGrader](https://community.instructure.com/en/kb/articles/661158-how-do-i-use-speedgrader)

**Features**:
- **Student List**: Left panel or dropdown showing all students
- **Current Student Indicator**: Eye icon shows currently viewed student
- **Status Indicators**: Visual indicators for submission status
- **Navigation Controls**: Next/Previous buttons or keyboard shortcuts

**Student Order**:
- Alphabetical by default (last name, first name)
- Can be sorted by submission status
- Can be filtered by section

### Section Filtering
**Evidence Level**: DOCUMENTED

**Interface**:
1. Click "Showing: All Sections" dropdown menu
2. Select desired section(s)
3. Click "Apply" to filter submissions

**Behavior**:
- Filters submission list to selected section(s)
- Multiple sections can be selected
- Improves performance for large courses

**Use Case**: Large courses should be separated into sections to improve SpeedGrader loading times

### Submission Status Indicators
**Evidence Level**: DOCUMENTED

**Status Types**:
- **No Submission**: Student has not submitted
- **Late**: Submitted after due date (with "late" label)
- **Submitted**: On-time submission
- **Resubmitted**: Multiple submission attempts

**Status Editing**:
- Click "Status" dropdown menu
- Manually change submission status if needed

### Navigation Methods
**Evidence Level**: DOCUMENTED

1. **Mouse/Click**:
   - Click student name in left panel
   - Click Next/Previous arrows
   - Click first/last student buttons

2. **Keyboard Shortcuts**:
   - `j`: Next student
   - `k`: Previous student
   - `Home`: First student in menu
   - `End`: Last student in menu

3. **Mobile** (swipe gestures):
   - Swipe left/right to move between students

### Anonymous Grading Navigation
**Evidence Level**: DOCUMENTED

**Behavior**:
- Student names hidden
- Students identified by "Student X" alias
- Submission menu displays "Submission 1, Submission 2" instead of dates
- Submission details hidden until assignment unmuted/posted

---

## Assignment Metadata Display

### Submission Details Panel
**Evidence Level**: DOCUMENTED

**Source**: [View Submission Details in SpeedGrader](https://community.instructure.com/en/kb/articles/664275-how-do-i-view-the-details-of-a-submission-for-a-student-in-speedgrader)

**Information Displayed**:
1. **Student Name**: (or "Student X" for anonymous grading)
2. **Submission Date/Time**: When assignment was submitted
3. **Late Indicator**: Red "late" label if submitted after due date
4. **Submission Type**: File upload, text entry, URL, etc.
5. **File Name(s)**: For file uploads
6. **Submission Attempt**: For multiple attempts
7. **Current Grade**: Previously assigned grade (if any)
8. **Rubric**: If attached to assignment
9. **Comments History**: Previous feedback

### Assignment Information
**Evidence Level**: DOCUMENTED

**Details Available**:
- Assignment name
- Point value / possible points
- Due date
- Submission requirements
- Assignment instructions (if configured to display)

### Attempt Handling
**Evidence Level**: DOCUMENTED

**5-Minute Grace Period** (Quizzes):
- Quiz submission timestamp includes 5-minute grace period after time limit/due date
- May not align with allotted time
- Applied automatically

---

## Grade Entry Interface

### Grade Field
**Evidence Level**: DOCUMENTED

**Source**: [Using SpeedGrader](https://community.instructure.com/en/kb/articles/661158-how-do-i-use-speedgrader)

**Features**:
- Grade entry field in right panel
- Displays current grade (if any)
- Shows point value or percentage (based on gradebook settings)
- Auto-saves when navigating to next submission

**Grade Types**:
- **Points**: Numeric point value
- **Percentage**: Percentage score
- **Letter Grade**: Letter grade (A, B, C, etc.)
- **GPA Scale**: GPA value
- **Complete/Incomplete**: Binary completion status
- **Not Graded**: No grade field (for ungraded assignments)

### Grade Entry Behavior
**Evidence Level**: DOCUMENTED

**Auto-Save**:
- Grade auto-submits when navigating to new submission
- No manual save button required for grades
- Immediate save to gradebook

**Manual Grade Entry**:
1. Click in grade field (or press `g` keyboard shortcut)
2. Enter grade value
3. Navigate to next student (grade saves automatically)
4. OR: Click outside field to save without navigating

### Rubric Integration
**Evidence Level**: DOCUMENTED

**Auto-Population**:
- If rubric set for grading ("Use this rubric for assignment grading" checked)
- Total rubric points automatically populate grade field
- Overrides manual grade entry

**Manual Entry**:
- If rubric not set for grading
- Can still use rubric for feedback
- Must enter grade manually

### Fudge Points (Quizzes)
**Evidence Level**: DOCUMENTED

**Source**: [Grade Quiz Questions in SpeedGrader](https://community.instructure.com/en/kb/articles/664299-how-do-i-grade-quiz-questions-in-speedgrader-with-performance-and-usability-upgrades)

**Feature**: Fudge points field to adjust quiz score
**Behavior**: Adds or subtracts points from total quiz score
**Use Case**: Adjust for ambiguous questions, technical issues, etc.

### Excused Assignments
**Evidence Level**: DOCUMENTED

**Feature**: Can excuse student from assignment
**Behavior**: 
- Assignment marked as "Excused" 
- Does not affect student's grade calculation
- Visible in gradebook and grade history

---

## Grading Rubrics System

### Rubric Structure
**Evidence Level**: DOCUMENTED

**Source**: 
- [How to Use Rubrics in SpeedGrader](https://community.instructure.com/en/kb/articles/664287-how-do-i-use-a-rubric-to-grade-submissions-in-speedgrader)
- [Canvas Rubrics Guide - ASU](https://tlc.sols.asu.edu/support/canvas/canvas-editing-managing-rubrics)

**Components**:

1. **Rubric Title**: Name of rubric
2. **Criteria**: Rows defining what is assessed (up to 5 per rubric in Enhanced view)
3. **Ratings**: Columns defining performance levels per criterion (up to 5 per criterion)
4. **Point Values**: Points assigned to each rating
5. **Descriptions**: Text describing expectations for each rating level

**Criterion Structure**:
```
Criterion Name
  - Description of criterion (what is being assessed)
  - Multiple ratings (performance levels)
    - Rating Label (e.g., "Excellent", "Good", "Fair", "Poor")
    - Point Value (e.g., 10, 7, 5, 2)
    - Rating Description (what earns this level)
```

### Rubric Types
**Evidence Level**: DOCUMENTED

1. **Scoring Rubric**: 
   - Includes point values
   - Used for grading ("Use this rubric for assignment grading" checked)
   - Points auto-populate grade field

2. **Non-Scoring Rubric**: 
   - No point values
   - Used for feedback only
   - Does not affect grade

3. **Free-Form Comment Rubric**:
   - Ratings hidden
   - Text comment field per criterion
   - Optional point entry per criterion

### Rubric Views (Enhanced Rubrics)
**Evidence Level**: DOCUMENTED

**Source**: [Enhanced Rubrics Guide - A-State](https://kb.astate.edu/books/canvas-instructor-how-tos/page/how-do-i-use-a-rubric-to-grade-submissions-in-speedgrader-using-enhanced-rubrics)

**Traditional View**:
- Grid format with criteria in rows, ratings in columns
- Familiar spreadsheet-like layout
- Click rating to select
- Point value shows in points field

**Horizontal View**:
- Criteria side-by-side
- Emphasizes readability across performance levels
- Reduces scrolling for longer descriptions

**Vertical View**:
- Performance levels stacked beneath each criterion
- One criterion at a time focus
- Improves accessibility and readability
- Better for detailed feedback

### Using Rubrics in SpeedGrader
**Evidence Level**: DOCUMENTED

**Workflow**:
1. Open submission in SpeedGrader
2. Click "View Rubric" button
3. (Optional) Select rubric view from dropdown
4. For each criterion:
   - Click rating that applies to submission
   - Rating value populates in Points field
   - Can manually adjust point value (if range rating)
   - Add criterion-specific comment (click Comment icon in Traditional view, or use Comment field)
5. Click "Save" or "Submit Assessment" button
6. Rubric points populate grade field (if set for grading)

### Point Ranges
**Evidence Level**: DOCUMENTED

**Feature**: Criterion can have point range instead of fixed value
**Example**: Rating could be "8-10 points" instead of just "10 points"

**Behavior**:
- Clicking range rating selects entire range
- Defaults to highest value in range
- Can manually enter different value within range
- Can also enter points above maximum (extra credit)

### Criterion Comments
**Evidence Level**: DOCUMENTED

**Feature**: Add comment to individual criterion
**Location**: 
- Traditional View: Click Comment icon within pts box
- Enhanced Views: Comment field below criterion

**Purpose**: Explain rating choice, provide specific feedback per criterion

### Rubric and Outcomes
**Evidence Level**: DOCUMENTED

**Source**: [Outcomes in Rubrics - FSU](https://support.canvas.fsu.edu/kb/article/1129-how-to-apply-outcomes-to-a-canvas-rubric/)

**Integration**: Outcomes can be imported as rubric criteria

**"Use this criterion for scoring" Checkbox**:
- **Checked**: Outcome points count toward assignment grade
- **Unchecked**: Outcome assessed for mastery tracking only, doesn't affect grade

**Outcome Properties**:
- Mastery threshold (minimum points for mastery)
- Multiple rating levels
- Calculation method (weighted average, most recent, highest, etc.)
- Tracked in Learning Mastery Gradebook

**Outcome Extra Credit**:
- Can assign points above criterion maximum (if feature enabled)
- Supports exceeding mastery level

### Student Self-Assessment
**Evidence Level**: DOCUMENTED

**Feature**: Students can assess their own work using rubric (if enabled)
**Instructor View**: Toggle "View Student Self Assessment" to see:
- Student comments
- Student's self-assessment (green solid line)
- Instructor's assessment (green dashed line)
- Comparison between self and instructor assessment

---

## Comment System

### Comment Types
**Evidence Level**: DOCUMENTED

**Source**: [Leave Feedback Comments in SpeedGrader](https://community.instructure.com/en/kb/articles/664292-how-do-i-leave-feedback-comments-for-student-submissions-in-speedgrader)

1. **Text Comments**:
   - Rich Content Editor with formatting options
   - Bold, italic, lists, links, etc.
   - Math equation editor
   - Emoji support (if enabled)

2. **File Attachment Comments**:
   - Attach file to comment
   - Any file type
   - Click Attach icon

3. **Media Comments**:
   - Webcam video recording
   - Screen capture recording
   - Audio recording
   - Upload pre-recorded media file
   - Click Media icon

4. **Speech Recognition Comments** (Chrome only):
   - Voice-to-text for comments
   - Chrome speech recognition tool

5. **Comment Library Comments**:
   - Pre-made comment templates
   - Click Comment Library icon
   - Reuse common feedback phrases

### Comment Interface
**Evidence Level**: DOCUMENTED

**Location**: "Assignment Comments" section in right panel
**Alternative Label**: "Comments for this Attempt" (with Assignment Enhancements)

**Features**:
- Comment text field
- Rich Content Editor toolbar
- Formatting options
- Media/file attachment buttons
- Comment history display

### Comment Submission
**Evidence Level**: DOCUMENTED

**Manual Submission Required**:
- Comments must be manually submitted (unlike grades)
- Click Submit button or press designated key
- Unsaved comment triggers warning when navigating away

**Navigation Warning**:
- Warning displays if navigating before submitting comment
- "Proceed" button saves comment as draft
- "Do not show again for this assignment" checkbox available
- Stored per-assignment and per-browser

### Draft Comments
**Evidence Level**: DOCUMENTED

**Indicators**:
- "Draft" pill displays next to unsubmitted comment
- Colored background (often pink) for draft comment
- Submit button visible for draft

**Draft Persistence**:
- Saved per-submission
- Browser-local storage
- Retrieved when returning to submission
- Can submit or delete later

**Student Visibility**:
- Students cannot see draft comments
- Only submitted comments visible to students

### Comment Threading
**Evidence Level**: DOCUMENTED

**Features**:
- Students can reply to instructor comments
- Replies display in thread below original comment
- Conversation-style discussion

**Inbox Integration**:
- Assignment comments display as new thread in Canvas Inbox
- Both instructor and student see comment threads in Inbox

**Notification Limitation**:
- Canvas does NOT send notification for comment replies in DocViewer
- For replies requiring notification, make comment in grading pane instead

**Source**: [UW-Extension DocViewer Tip Sheet](https://id.uwex.edu/tip-sheets/DocViewer.pdf)

---

## DocViewer Integration

### Inline Annotations
**Evidence Level**: DOCUMENTED

**Integration**: DocViewer embedded in SpeedGrader for supported file types

**Capabilities** (see CANVAS_DOCVIEWER_RESEARCH.md for full details):
- 6 annotation types (Point, Area, Highlight, Strikeout, Free Draw, Free Text)
- Color selection
- Comment attachment to annotations
- Annotation editing (move, delete)
- Undo/redo functionality

**Synchronization**:
- DocViewer annotations sync with SpeedGrader
- Mobile annotations appear in web SpeedGrader
- Cross-platform consistency

### Document Preview
**Evidence Level**: DOCUMENTED

**Supported Files**: See CANVAS_DOCVIEWER_RESEARCH.md for complete list
**Display**: Center panel shows document preview with DocViewer controls
**Toolbar**: DocViewer toolbar appears above document

### Annotation Comments vs Assignment Comments
**Evidence Level**: DOCUMENTED

**Distinction**:

1. **DocViewer Annotation Comments**:
   - Attached to specific annotations in document
   - Location-specific feedback
   - Visible within document when viewing feedback
   - Can be concurrent with other graders (generally safe)

2. **Assignment Comments** (Grading Pane):
   - General comments in right panel
   - Not location-specific
   - Appears in comment history and Inbox
   - Sends notifications for replies

**Source**: [Canvas Community - Leave Feedback](https://community.instructure.com/en/kb/articles/664292-how-do-i-leave-feedback-comments-for-student-submissions-in-speedgrader)

---

## Draft vs Published Feedback

### Draft Feedback Concept
**Evidence Level**: DOCUMENTED

**Definition**: Feedback (grades, comments, annotations) created but not yet visible to students

**Types of Draft Content**:

1. **Draft Assignment Comments**:
   - Unsaved comments in grading pane
   - Marked with "Draft" pill
   - Submit button required

2. **Unpublished Grades**:
   - Grades entered but not posted (manual posting policy)
   - Hidden from students
   - Visible to instructors in gradebook

3. **Hidden DocViewer Annotations**:
   - Annotations created and saved
   - Subject to grade posting policy
   - Hidden until grades posted

### Draft Indicators
**Evidence Level**: DOCUMENTED

**Visual Cues**:
- "Draft" pill next to comment
- Colored background for unsubmitted comment
- Submit button present
- Warning when navigating away

### Draft Workflow
**Evidence Level**: DOCUMENTED

**Process**:
1. Instructor creates comment/annotation
2. Comment saved as draft (if not submitted)
3. Instructor can:
   - Submit comment (makes it visible pending posting policy)
   - Delete draft
   - Edit draft
   - Leave draft and return later

### Why Drafts Matter
**Evidence Level**: DOCUMENTED

**Use Cases**:
1. **Incomplete Grading**: Mark up document, finish grading later
2. **Review Before Release**: Double-check feedback before students see it
3. **Moderated Grading**: Multiple graders review before final release
4. **Bulk Release**: Grade entire class, release all at once

---

## Publication Workflow

### Grade Posting Policy
**Evidence Level**: DOCUMENTED

**Source**: [Managing Grade Release](https://www.elearning.fse.manchester.ac.uk/getting-started-with-canvas/managing-the-release-of-grades/)

**Policy Types**:

1. **Automatic Posting** (Default in some institutions):
   - Grades visible to students immediately when entered
   - Comments visible immediately when submitted
   - Annotations visible immediately (subject to anonymous constraints)
   - No moderation or review period

2. **Manual Posting** (Recommended for controlled release):
   - Grades hidden from students until explicitly posted
   - Comments hidden until posted
   - Annotations hidden until posted
   - Allows time for review, moderation, curve adjustments

### Setting Posting Policy
**Evidence Level**: DOCUMENTED

**Locations**:
- **Course-wide**: Gradebook settings (set default for all assignments)
- **Per-assignment**: Assignment settings (override course default)

**Course-wide Setup**:
1. Click Grades in Course Navigation
2. Click Gradebook menu → Settings
3. Select "Automatically Post Grades" or "Manually Post Grades"

**Per-assignment**:
- Set when creating assignment
- Can change later in assignment settings

### Posting Grades (Manual Policy)
**Evidence Level**: DOCUMENTED

**Source**: [Post Grades in SpeedGrader - Stanford](https://canvashelp.stanford.edu/hc/en-us/articles/360043729773-Post-grades-comments-within-SpeedGrader)

**From SpeedGrader**:
1. Click eye-with-slash icon in upper left corner
2. Select "Post Grades" option
3. Choose posting scope:
   - **Everyone**: All current and future grades/comments visible immediately
   - **Graded**: Only currently graded submissions visible; future grades still hidden
   - **Specific Sections**: Post to selected sections only
4. Confirm

**From Gradebook**:
1. Click Grades
2. Click assignment column menu → Post Grades
3. Select scope (Everyone, Graded, Specific Sections)
4. Confirm

**Eye Icon Indicators**:
- **Eye with slash**: Some grades/comments hidden
- **Eye without slash**: All grades/comments posted (or none entered)

### What Posting Releases
**Evidence Level**: DOCUMENTED

**Content Made Visible**:
1. **Grade**: Numeric/letter grade visible in student's Grades page
2. **Assignment Comments**: Text/media comments visible in assignment details
3. **DocViewer Annotations**: Annotations and comments visible when viewing feedback
4. **Rubric**: Completed rubric with scores and comments visible

### Hide Grades (Retraction)
**Evidence Level**: DOCUMENTED

**Feature**: Can hide grades after posting (for corrections, grade changes, etc.)
**Process**: Similar to posting, but selects "Hide Grades" instead
**Effect**: Returns grades/feedback to hidden state

---

## Student Visibility & Reply

### Student View of Feedback
**Evidence Level**: DOCUMENTED

**Access Method**:
1. Student navigates to Grades page
2. Clicks assignment name
3. Views submission details
4. Sees grade, comments, and "View Feedback" link (if DocViewer content exists)

**What Students See**:
- Final grade (if posted)
- Assignment comments (if posted)
- Rubric with scores and comments (if posted)
- DocViewer annotations with comments (if posted, via "View Feedback" link)

### Student Reply Capability
**Evidence Level**: DOCUMENTED

**Assignment Comments**:
- Students can reply to instructor comments in grading pane
- Reply appears in comment thread
- Visible to instructor
- Triggers notification (if enabled)
- Creates Inbox thread

**DocViewer Comments**:
- Students can reply to annotation comments
- Reply button available on comments
- Nested reply structure
- **Limitation**: Canvas doesn't send notification for DocViewer comment replies

**Source**: 
- [Canvas Community - View Feedback](https://community.instructure.com/en/kb/articles/661231-how-do-i-view-annotation-feedback-comments-from-my-instructor-directly-in-my-assignment-submission)
- [UW-Extension DocViewer Tip Sheet](https://id.uwex.edu/tip-sheets/DocViewer.pdf)

### Student Annotation Capability
**Evidence Level**: DOCUMENTED

**Permission**: Students can annotate their own submissions (if institution allows)

**Capabilities**:
- All 6 annotation types available
- Can add comments
- Can reply to instructor comments
- Can delete own annotations
- Cannot edit/delete instructor annotations

**Restrictions**:
- May be disabled by institution
- Cannot annotate if assignment submissions don't support DocViewer

**Source**: [Canvas Community - DocViewer Student View](https://community.instructure.com/en/kb/articles/661230-how-do-i-use-docviewer-in-canvas-assignments-as-a-student)

### Viewing Orientation
**Evidence Level**: DOCUMENTED

**Constraint**: Students view annotations in orientation selected by grader
**Implication**: If instructor rotates document, students see same rotation

---

## Submission Version Handling

### Multiple Attempts
**Evidence Level**: DOCUMENTED

**Source**: [Student Resubmit Assignments](https://community.instructure.com/en/kb/articles/660692-can-a-student-resubmit-canvas-assignments)

**Configuration**:
- **Assignment Setting**: "Allowed Attempts" dropdown
  - **Unlimited**: Student can submit indefinitely
  - **Limited**: Specify number (1, 2, 3, etc.)

**Student Interface**:
- "New Attempt" button appears after submission (if more attempts allowed)
- Button disabled when all attempts used

### Viewing Submission Versions
**Evidence Level**: DOCUMENTED

**Interface**: "Submission to View" dropdown menu (below student name)

**Behavior**:
1. Dropdown shows all submission attempts
2. Most recent submission shown by default
3. Select previous attempt from dropdown
4. Warning displays when viewing non-latest submission: "You are not viewing the most recent submission"

**Information Displayed**:
- Submission date/time for each attempt
- "Late" indicator if applicable
- Submission number (for anonymous grading)

### Grading Multiple Attempts
**Evidence Level**: DOCUMENTED

**Default**: Most recent submission graded
**Can view/grade previous attempts**: Select from dropdown

**Regrade Feature**:
- If already graded earlier attempt
- Option: "Use this same grade for the resubmission" link
- Applies previous grade to new attempt without re-grading

### Student Visibility of Previous Attempts
**Evidence Level**: DOCUMENTED

**Limitation**: Students cannot view their own previous submissions after resubmitting

**Workaround**: Instructor can re-upload previous submissions to Canvas if needed

### Quiz Attempts
**Evidence Level**: DOCUMENTED

**Standard Handling**: Same as assignments (dropdown for attempts)

**Large Quiz Limitation**:
- If quiz has more than 65 total submissions, individual attempts cannot be viewed in SpeedGrader
- **Classic Quizzes**: Click "See all quiz attempts" link
- **New Quizzes**: Click "Moderate" button

**Source**: [View Submission Details](https://community.instructure.com/en/kb/articles/664275-how-do-i-view-the-details-of-a-submission-for-a-student-in-speedgrader)

---

## Grading History & Audit Trails

### Gradebook History
**Evidence Level**: DOCUMENTED

**Source**: 
- [View Gradebook History](https://community.instructure.com/en/kb/articles/660864-how-do-i-view-the-history-of-all-grading-changes-in-the-gradebook)
- [Grade Change Log API](https://canvas.instructure.com/doc/api/grade_change_log.html)

**Purpose**: Read-only log of all grade changes in course

**Access**:
1. Click Grades in Course Navigation
2. Click Gradebook menu
3. Select "Gradebook History"

### History Information Displayed
**Evidence Level**: DOCUMENTED

**For Each Grade Change**:
1. **Date**: When grade was changed
2. **Student**: Whose grade was changed
3. **Grader**: Who changed the grade
4. **Artifact/Assignment**: Where grade was changed
5. **From**: Grade before change
6. **To**: Grade after change
7. **Current**: Current grade for assignment

### History Filters
**Evidence Level**: DOCUMENTED

**Filter Options**:
1. **By Student**: Type student name, select from results
2. **By Grader**: Type grader name, select from results
3. **By Assignment**: Type assignment name, select from results
4. **By Date**: 
   - Start date (from when)
   - End date (to when)
   - Calendar picker

**Combination**: Multiple filters can be applied simultaneously

### History Retention
**Evidence Level**: DOCUMENTED

**Time Window**: Last 365 days of grade changes

**Scope**: 
- All graded items (assignments, quizzes, discussions)
- Includes manual posting policy changes (even if not visible to students)
- Final Grade Overrides (if feature enabled)

### Anonymous Assignment History
**Evidence Level**: DOCUMENTED

**Behavior**:
- Grade changes for anonymous assignments don't include student names
- Icon shows assignment was previously graded anonymously
- Posting grades removes anonymity

### Audit Trail Permissions
**Evidence Level**: DOCUMENTED

**Source**: [Permissions - View Audit Trail](https://developerdocs.instructure.com/services/canvas/permissions/details/file.permissions_view_audit_trail)

**Instructors**: "Grades - view audit trail" permission required
**Admins**: Can search Grade Change Activity in Admin Tools

**Additional Requirements**:
- **To moderate grades**: "Grades - Select final grade for moderation" also needed
- **To post/hide grades**: "Grades - edit" also needed

### API Access
**Evidence Level**: DOCUMENTED

**Endpoints**:
- `GET /api/v1/audit/grade_change/courses/:course_id`
- `GET /api/v1/audit/grade_change/assignments/:assignment_id`
- `GET /api/v1/audit/grade_change/students/:student_id`
- `GET /api/v1/audit/grade_change/graders/:grader_id`

**Parameters**:
- `start_time`: Beginning of time range (DateTime)
- `end_time`: End of time range (DateTime)

**Response**: Paginated list of GradeChangeEvent objects with:
- Event ID
- Timestamp (created_at)
- Event type (grade_change)
- Grade before/after
- Excused before/after (boolean)
- Graded anonymously (boolean)
- Version number
- Request ID
- Links to assignment, course, student, grader, page view

---

## Notification System

### Notification Types
**Evidence Level**: DOCUMENTED

**Source**: 
- [Canvas Notifications](https://community.instructure.com/en/kb/articles/387041-canvas-notifications)
- [Instructor Notification Recommendations - Yale](https://help.canvas.yale.edu/a/920483-instructor-notification-recommendations)

**Relevant to SpeedGrader/Grading**:

1. **Submission Comment**:
   - **Trigger**: Student adds comment to submission, instructor adds comment, annotation comment
   - **Content**: Comment text, student name, course, assignment
   - **Default**: Daily summary
   - **Anonymous**: Notification sent without user name if comment anonymous

2. **Assignment Submitted Late**:
   - **Trigger**: Student submits assignment after due date
   - **Content**: Student name, assignment, submission time
   - **Default**: Not specified

3. **Grading** (various):
   - Grade posted
   - Assignment graded
   - Rubric assessment

### Notification Settings
**Evidence Level**: DOCUMENTED

**Configuration Location**: 
- Account → Settings → Notifications
- Course-level overrides available

**Frequency Options**:
- **Notify immediately**: Real-time notification
- **Daily summary**: Once per day
- **Weekly summary**: Once per week
- **Do not send**: Disabled

**Delivery Methods**:
- Email (primary)
- SMS (if configured)
- Push notifications (mobile app)

### Submission Comment Notifications
**Evidence Level**: DOCUMENTED

**Instructor Receiving Notifications**:
- Set "Submission Comment" to "Notify immediately" to receive alerts when students comment
- Email includes link back to assignment
- Can review in Canvas Inbox or Gradebook

**Student Receiving Notifications**:
- Triggered when instructor submits comment
- Requires "Submission Comment" notification enabled
- Manual posting policy may affect timing (need to post grades/comments)

**Source**: [Set Notifications for Submission Comments - ASU](https://lx.asu.edu/lxresource/how-set-notifications-review-submission-comments-students)

### Notification Limitations
**Evidence Level**: DOCUMENTED

**DocViewer Comment Replies**: 
- Canvas does NOT send notifications for replies to DocViewer annotation comments
- Workaround: Use grading pane comments instead for discussion requiring notifications

**Source**: [UW-Extension DocViewer Tip Sheet](https://id.uwex.edu/tip-sheets/DocViewer.pdf)

---

## Downloadable Feedback

### Download Submissions
**Evidence Level**: DOCUMENTED

**Bulk Download**:
- Can download all student submissions at once
- Accessed from assignment page (not SpeedGrader)
- Downloads as ZIP file

**Individual Download**:
- Download button in DocViewer toolbar
- Downloads annotated PDF with comments
- See CANVAS_DOCVIEWER_RESEARCH.md for details

### Download Submission Comments
**Evidence Level**: DOCUMENTED

**Feature**: Can download or print submission comments
**Location**: SpeedGrader interface
**Format**: Printable document with comment history

### Download Rubric Assessments
**Evidence Level**: DOCUMENTED

**Source**: [Enhanced Rubrics - SPU](https://spu.atlassian.net/wiki/spaces/ETMH/pages/1034256394/Enhanced+Rubrics)

**Bulk Rubric Download**:
- Available from Gradebook
- Can bulk download rubric assessments
- Can import updated rubric assessments (bulk upload)
- CSV format

### Export Formats
**Evidence Level**: INFERRED

**Likely Formats**:
- PDF (for annotated submissions)
- CSV (for rubric assessments and grade data)
- ZIP (for bulk submission downloads)

**Confirmation**: Specific export formats for all feedback types not fully documented

---

## Permission Model

### Instructor Roles
**Evidence Level**: DOCUMENTED

**Standard Instructor Permissions**:
- View all student submissions
- Grade assignments
- Use rubrics
- Leave comments (text, media, file)
- Create annotations in DocViewer
- Post/hide grades
- View gradebook history

### Section-Limited Graders
**Evidence Level**: DOCUMENTED

**Source**: [How to Use SpeedGrader](https://community.instructure.com/en/kb/articles/661158-how-do-i-use-speedgrader)

**Configuration**: Graders can be limited to interact only with users in specific section

**Behavior**:
- Can only view/grade submissions from assigned section
- Prevents grading overlap between multiple graders
- Gradebook History shows only same-section results

**Use Case**: Multiple TAs/graders in large course

### Moderated Grading
**Evidence Level**: DOCUMENTED

**Feature**: Moderated assignment workflow for multiple graders

**Process**:
1. Multiple graders assess submissions independently
2. Moderator reviews all grader assessments
3. Moderator selects final grade
4. Final grade released to students

**SpeedGrader Behavior**:
- If max graders reached, SpeedGrader read-only mode
- Student names and details hidden
- Cannot edit until moderator releases grades

**Permissions Required**:
- "Grades - Select final grade for moderation" permission needed

### Student Permissions
**Evidence Level**: DOCUMENTED

**Standard Student Capabilities**:
- View own submissions
- View posted grades and feedback
- Reply to instructor comments
- Annotate own submissions (if enabled)

**Restrictions**:
- Cannot view other students' submissions (unless peer review)
- Cannot see draft comments
- Cannot see unpublished grades
- Cannot delete instructor annotations

### Anonymous Grading Permissions
**Evidence Level**: DOCUMENTED

**Anonymous Grading Mode**:
- Student names hidden from graders
- Student aliases used ("Student 1", "Student 2", etc.)
- Submission details hidden
- DocViewer annotations affected by anonymity
- Unmuting/posting reveals identities

**Anonymous Peer Review**:
- DocViewer does not support anonymous comments
- Peer review annotations not anonymous even if assignment setting enabled

---

## Keyboard Shortcuts

### SpeedGrader Shortcuts
**Evidence Level**: DOCUMENTED

**Source**: [Canvas Keyboard Shortcuts - Illinois](https://answers.uillinois.edu/illinois/115004)

| Key | Action |
|-----|--------|
| `j` | Next student |
| `k` | Previous student |
| `c` | Leave comment (focus comment field) |
| `g` | Change grade (focus grade field) |
| `r` | Use rubric (open/focus rubric) |
| `Home` | First student in list |
| `End` | Last student in list |
| `Shift+?` | View keyboard shortcuts help window |

### Shortcut Requirements
**Evidence Level**: DOCUMENTED

**Focus Requirement**:
- Shortcuts only work when submission info/grading panel has focus
- If clicked on document or annotation, shortcuts won't work until clicking back to panel
- After using `c` or `g` shortcuts, must click outside text field before using another shortcut

**Disable Option**:
- Can be disabled in User Settings → Feature Settings
- Per-user preference
- Disabled by default for some users

### Rich Content Editor Shortcuts
**Evidence Level**: DOCUMENTED

**Access**: `Alt+F8` (PC) or `Option+F8` (Mac) in Rich Content Editor
**Purpose**: View shortcuts for text formatting, links, etc.

---

## Mobile Support

### Canvas Teacher App
**Evidence Level**: DOCUMENTED

**Source**: 
- [What Can I Do in Canvas Teacher App - Emerson](https://support.emerson.edu/hc/en-us/articles/360048779991-What-Can-I-Do-in-the-Canvas-Teacher-App)
- [Grade in Teacher App - Android](https://community.instructure.com/en/kb/articles/661887-how-do-i-grade-an-assignment-submission-in-the-teacher-app-on-my-android-device)

**Platform Support**:
- iOS (iPhone and iPad)
- Android (phone and tablet)

**SpeedGrader Features in Mobile**:
- View submissions
- Enter grades
- Use rubrics
- Leave comments (text, audio, video)
- Add DocViewer annotations (full support)
- Swipe between students
- Access submission history

### Mobile Navigation
**Evidence Level**: DOCUMENTED

**Access Method**:
1. Open course in app
2. Tap Assignments
3. Tap assignment name
4. Tap "Need Grading" status
5. Tap student name
6. View submission in mobile SpeedGrader

**Swipe Navigation**:
- Swipe left: Next student
- Swipe right: Previous student
- Swipe up: View next page (multi-page documents)

### Mobile Grade Entry
**Evidence Level**: DOCUMENTED

**Process**:
1. Tap "GRADE" tab
2. Tap plus (+) sign
3. Enter grade
4. Grade auto-saves

### Mobile Comments
**Evidence Level**: DOCUMENTED

**Tab**: "COMMENTS" tab shows comment history
**Features**:
- View correspondence with student
- Enter new comments
- Tap plus (+) for audio/video comments

**Comment Types**:
- Text comments
- Audio comments (record via mic)
- Video comments (record via camera)
- Media uploads

### Mobile Rubrics
**Evidence Level**: DOCUMENTED

**Access**: Available in mobile SpeedGrader
**Functionality**: 
- View rubric criteria
- Select ratings
- Enter points
- Add criterion comments
- Submit assessment

### Mobile Grade Posting
**Evidence Level**: DOCUMENTED

**Feature**: Eye icon in upper-right of SpeedGrader
**Action**: Post or hide all grades for assignment
**Same Behavior**: As desktop version

### Mobile Limitations
**Evidence Level**: DOCUMENTED

**Restrictions**:
1. **Multiple users**: Should not grade simultaneously (same as desktop)
2. **File uploads**: Cannot upload files to assignment submissions when grading
3. **Full feature parity**: Some advanced features may be desktop-only

**Source**: [Grade in Teacher App - Android](https://community.instructure.com/en/kb/articles/661887-how-do-i-grade-an-assignment-submission-in-the-teacher-app-on-my-android-device)

---

## Performance & Scalability

### Data Loading Model
**Evidence Level**: DOCUMENTED

**Source**: [How to Use SpeedGrader](https://community.instructure.com/en/kb/articles/661158-how-do-i-use-speedgrader)

**Behavior**:
- All assignment data loaded into browser at SpeedGrader launch
- Includes: submissions, grades (including original grades for resubmissions), rubrics, comments
- Data cached in browser
- Navigating between submissions does NOT load updates
- Must refresh browser to see changes made by other graders

**Purpose**: Reduce load time, enable quick navigation between students

### Large Course Performance
**Evidence Level**: DOCUMENTED

**Threshold System**:
- Performance affected by data points loadable within 60-second window
- Based on single submission per student (multiple submissions increase load)

**Performance Degradation**:
- **1500+ submissions**: May result in delayed loading times
- **2500+ submissions**: May fail to load completely

### Performance Recommendations
**Evidence Level**: DOCUMENTED

**Best Practices**:
1. **Use Sections**: 
   - Separate large courses into sections
   - Filter SpeedGrader by section
   - Reduces data points loaded

2. **Limit Submissions**:
   - Fewer submission attempts = better performance
   - Consider assignment design

3. **Filter Early**:
   - Select section filter before loading all data
   - Improves initial load time

### Concurrent Grading Issues
**Evidence Level**: DOCUMENTED

**Source**: 
- [Avoid Data Loss - Stanford](https://canvashelp.stanford.edu/hc/en-us/articles/115007357988-Avoid-data-loss-when-multiple-graders-use-SpeedGrader)
- [Known Issue - Melbourne](https://lms.unimelb.edu.au/updates/known-issues/canvas-lms/known-issue-speedgrader)

**Problem**: SpeedGrader designed for one grader at a time per student

**Data Cached in Browser**: Changes by other graders not visible until refresh

**Risk of Data Loss** (for same student in overlapping sessions):
- ❌ Editing assignment rubric
- ❌ Editing overall assignment grade
- ❌ Editing quiz question scores/comments

**Safe for Concurrent** (same student):
- ✅ Adding DocViewer annotation comments
- ✅ Adding assignment comments (sidebar)

### Solutions for Multiple Graders
**Evidence Level**: DOCUMENTED

**Option 1: Time-Based Scheduling**:
- Only one grader uses SpeedGrader at a time
- Grader completes session before next grader launches

**Option 2: Section-Based Assignment**:
- Each grader assigned specific sections
- Graders use section filter
- No overlap in students graded

**Option 3: Refresh Between Students**:
- If overlapping sessions unavoidable
- Refresh browser before loading each new student
- Gets latest data
- Still risk if editing same student simultaneously

**Source**: [Multiple Graders in SpeedGrader - KTH](https://intra.kth.se/en/utbildning/systemstod/canvas/guider/omdomen/speedgrader/flera-bedomare-1.1369986)

---

## Known Limitations

### Submission Limitations
**Evidence Level**: DOCUMENTED

1. **Cannot delete submissions**: Instructors cannot delete student submissions; must contact admin
2. **Text entry assignments**: DocViewer annotations not available
3. **External tools**: Some features may not work with LTI assignments
4. **Multiple file submissions**: Some external tools may not support multi-file AGS submissions

### Rubric Limitations
**Evidence Level**: DOCUMENTED

1. **Cannot edit after multiple associations**: Once rubric used in multiple assignments, cannot edit
2. **Deletion cascades**: Deleting rubric removes from all associated assignments and removes all scores/assessments
3. **Maximum criteria (Enhanced view)**: 5 criteria per rubric in horizontal/traditional views
4. **Point values**: Cannot edit criteria if institution enabled course-wide mastery scales

**Source**: [Enhanced Rubrics - SPU](https://spu.atlassian.net/wiki/spaces/ETMH/pages/1034256394/Enhanced+Rubrics)

### Quiz Grading Limitations
**Evidence Level**: DOCUMENTED

1. **Question shuffling**: Order varies per student in SpeedGrader
2. **Zero points**: Must manually change from unscored to 0 for completion
3. **>65 submissions**: Individual attempts not viewable in SpeedGrader (use "See all quiz attempts" or "Moderate")
4. **Ungraded questions**: Notifications not sent until all questions have point values

**Rubric + New Quiz Issue**: Grade quiz questions first, then rubric; rubric-first can be overwritten by question scores

**Source**: [Grade Quiz Questions](https://community.instructure.com/en/kb/articles/664299-how-do-i-grade-quiz-questions-in-speedgrader-with-performance-and-usability-upgrades)

### Anonymous Grading Limitations
**Evidence Level**: DOCUMENTED

1. **Submission details hidden**: Until assignment unmuted/posted
2. **No anonymous peer review in DocViewer**: DocViewer doesn't support anonymous comments
3. **Posting removes anonymity**: Posting grades reveals student identities

### Performance Limitations
**Evidence Level**: DOCUMENTED

1. **1500+ submissions**: Delayed load times
2. **2500+ submissions**: May fail to load
3. **Browser cache**: Must refresh to see other graders' changes
4. **Concurrent grading**: Risk of data loss if multiple graders edit same submission

### Notification Limitations
**Evidence Level**: DOCUMENTED

1. **DocViewer reply notifications**: Not sent for DocViewer comment replies
2. **Manual posting delay**: Notifications may not send until grades posted

### Mobile Limitations
**Evidence Level**: DOCUMENTED

1. **File upload**: Cannot upload files to submissions when grading in app
2. **Feature parity**: Some advanced features desktop-only
3. **OpenDocument preview**: .ods/.odt not previewable in mobile apps

### History Limitations
**Evidence Level**: DOCUMENTED

1. **365-day retention**: Only last year of grade changes retained
2. **Section-limited view**: Section-limited graders see only their section history

---

## Summary of Key Findings

### Core Capabilities
✅ Unified grading interface for all assignment types
✅ Rubric-based assessment with multiple views
✅ Rich comment system (text, audio, video, file attachments)
✅ DocViewer integration for inline annotations
✅ Draft and published feedback workflows
✅ Manual and automatic grade posting policies
✅ Submission version/attempt handling
✅ Grade history and audit trails
✅ Notification system for submission comments
✅ Mobile app support (iOS and Android)
✅ Keyboard shortcuts for navigation

### Integration Points
✅ DocViewer (inline annotations)
✅ Rubrics (criterion-based assessment)
✅ Gradebook (grade synchronization)
✅ Canvas Inbox (comment threading)
✅ Outcomes (learning mastery tracking)
✅ Assignment settings (posting policy, attempts)

### Critical Workflows
1. **Grading Workflow**: View → Annotate → Grade → Comment → Submit/Post
2. **Rubric Workflow**: Open Rubric → Select Ratings → Add Comments → Submit Assessment
3. **Multi-Attempt Workflow**: Select Attempt → Grade → Compare → Regrade if needed
4. **Publishing Workflow**: Grade/Comment → (Manual Policy) → Post Grades → Students See

### Permission Model
- Instructor: Full access to view, grade, comment, post
- Section-limited graders: Restricted to assigned sections
- Students: View posted grades, reply to comments, optionally annotate
- Moderated grading: Multiple graders with moderator approval

### Performance Considerations
- Browser caching (refresh required for concurrent grading)
- Large course limits (1500-2500 submissions threshold)
- Section filtering for scalability
- Concurrent editing risks (rubrics, grades)

---

## Recommendations for MySL8TE Implementation

### Must-Have Features
1. Submission queue with navigation
2. Grade entry with auto-save
3. Comment system with threading
4. Rubric integration
5. Draft/publish workflow with manual posting
6. Submission version handling
7. Audit trail for grade changes

### Should-Have Features
1. Section/group filtering
2. Keyboard shortcuts
3. Multiple comment types (text, file, media)
4. Student reply capability
5. Grade history viewer
6. Notification system

### Nice-to-Have Features
1. Mobile-responsive interface
2. Bulk operations (download, export)
3. Comment library (pre-made templates)
4. Speech-to-text comments
5. Student self-assessment

### Integration Requirements
1. DocViewer component (see CANVAS_DOCVIEWER_RESEARCH.md)
2. Rubric engine
3. Notification service
4. Audit logging system
5. Permission management
6. Version control for submissions

### Performance Design
1. Pagination for large submission lists
2. Lazy loading of submission content
3. Section/group filtering from start
4. Optimistic UI updates with conflict resolution
5. Warn about concurrent editing

---

**Research Status**: COMPLETE  
**Next Steps**: Integrate findings into FEATURE_PARITY_MATRIX.md  
**Related Documents**: 
- CANVAS_DOCVIEWER_RESEARCH.md (DocViewer annotation details)
- CANVAS_EVIDENCE.md (Source links and references)
