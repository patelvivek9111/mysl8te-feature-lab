# System Architecture

## Mission Context
MySL8TE Feature Lab - Standalone document review and academic integrity platform

## Architecture Philosophy

### Core Principles
1. **Modular Design**: Independent, reusable modules with clear boundaries
2. **Standalone Deployment**: No dependency on existing MySL8TE application
3. **Integration-Ready**: Documented contracts for future integration
4. **Scalable Processing**: Background workers for document processing
5. **Real Data**: Persistent storage, no mock implementations
6. **Verifiable**: Every component testable and measurable

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Teacher Portal │  │ Student View │  │  Admin Panel     │   │
│  │  - Grading     │  │  - Submission │  │  - Configuration │   │
│  │  - Annotation  │  │  - Feedback   │  │  - User Mgmt    │   │
│  │  - Reports     │  │  - Reviews    │  │  - Reports      │   │
│  └────────────────┘  └──────────────┘  └──────────────────┘   │
│         React + TypeScript + Vite                               │
└─────────────────────────────────────────────────────────────────┘
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway Layer                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REST API + GraphQL + WebSocket (Node.js + Express)      │  │
│  │  - Authentication & Authorization                        │  │
│  │  - Request Validation                                    │  │
│  │  - Rate Limiting                                         │  │
│  │  - Audit Logging                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Services Layer                  │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Grading      │  │  Document    │  │   Annotation     │   │
│  │   Service      │  │  Service     │  │   Service        │   │
│  └────────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Similarity    │  │ AI Writing   │  │   Feedback       │   │
│  │  Service       │  │ Detection    │  │   Service        │   │
│  └────────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Processing Layer                            │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Document     │  │  Text        │  │   Similarity     │   │
│  │   Engine       │  │  Extraction  │  │   Matching       │   │
│  │   - Upload     │  │  - OCR       │  │   - Indexing     │   │
│  │   - Validation │  │  - Parsing   │  │   - Comparison   │   │
│  │   - Conversion │  │  - Clean     │  │   - Scoring      │   │
│  └────────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌────────────────┐  ┌──────────────┐                          │
│  │  AI Detection  │  │  Background  │                          │
│  │  Engine        │  │  Workers     │                          │
│  │  - Inference   │  │  - Job Queue │                          │
│  │  - Evaluation  │  │  - Retry     │                          │
│  └────────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   PostgreSQL   │  │  File        │  │   Search         │   │
│  │   - Users      │  │  Storage     │  │   Index          │   │
│  │   - Submissions│  │  - Original  │  │   - Full-text    │   │
│  │   - Annotations│  │  - Converted │  │   - Similarity   │   │
│  │   - Grades     │  │  - Assets    │  │   - Sources      │   │
│  │   - Reports    │  │              │  │                  │   │
│  └────────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### 1. Document Engine Module
**Location**: `src/document-engine/`

**Responsibilities**:
- File upload and validation
- Format detection (magic bytes, MIME types)
- Security scanning
- Format conversion (DOCX→PDF, etc.)
- Document rendering
- Text extraction
- OCR for images/scanned PDFs
- Metadata extraction
- Thumbnail generation

**Key Components**:
- `upload-handler.ts` - File reception and validation
- `format-detector.ts` - Content-based format detection
- `converters/` - Format-specific conversion adapters
- `extractors/` - Text extraction per format
- `renderers/` - Preview generation
- `ocr-engine.ts` - OCR integration

**Dependencies**:
- pdf-lib, pdfjs-dist (PDF)
- mammoth (DOCX)
- xlsx (Spreadsheets)
- sharp (Images)
- tesseract.js (OCR)

### 2. Annotation System Module
**Location**: `src/annotation-system/`

**Responsibilities**:
- Annotation data model
- Coordinate system management
- Annotation tools (highlight, comment, draw, sticky note)
- Persistence layer
- Version control
- Concurrent editing conflict resolution
- Export with annotations

**Key Components**:
- `models/annotation.ts` - Data model
- `coordinate-mapper.ts` - Coordinate system (page, pixel, %)
- `tools/` - Individual annotation tool implementations
- `persistence.ts` - Storage and retrieval
- `export-renderer.ts` - Annotated document export

**Coordinate System**:
- Store annotations in percentage-based coordinates
- Support zoom/rotation invariance
- Map to document structure (page, line, cell, timestamp)

### 3. Similarity Detection Module
**Location**: `src/similarity-detection/`

**Responsibilities**:
- Text normalization
- Tokenization
- N-gram generation
- Full-text indexing
- Similarity matching algorithms
- Source corpus management
- Source attribution
- Exclusion rules (quotes, bibliography, small matches)
- Report generation

**Key Components**:
- `text-processor.ts` - Normalization and tokenization
- `indexer.ts` - Full-text indexing
- `matcher.ts` - Similarity algorithms
- `corpus-manager.ts` - Source document management
- `exclusions.ts` - Exclusion rule engine
- `report-generator.ts` - Similarity report creation

**Algorithms**:
- Exact phrase matching
- Fuzzy matching (edit distance)
- Shingling (n-gram overlap)
- Jaccard similarity
- Longest common substring

### 4. AI Writing Detection Module
**Location**: `src/ai-writing-detection/`

**Responsibilities**:
- AI-generated text detection
- AI-paraphrased text detection
- Confidence scoring
- Passage-level classification
- Model inference
- Evaluation and calibration
- Report generation

**Key Components**:
- `detector.ts` - Detection interface
- `models/` - Model implementations/wrappers
- `evaluation.ts` - Accuracy measurement
- `calibration.ts` - Confidence calibration
- `report-generator.ts` - AI detection report

**Approach Options**:
1. **Third-party API**: OpenAI Classifier API, GPTZero API, etc.
2. **Self-hosted Model**: Fine-tuned transformer model
3. **Hybrid**: Ensemble of multiple detectors

### 5. Grading System Module
**Location**: `src/grading-system/`

**Responsibilities**:
- Assignment management
- Submission handling
- Grading interface
- Rubric engine
- Feedback drafts
- Publication workflow
- Student view
- Grading history
- Audit trail

**Key Components**:
- `assignment.ts` - Assignment model
- `submission.ts` - Submission handling
- `rubric-engine.ts` - Rubric evaluation
- `feedback-manager.ts` - Draft/publish logic
- `grade-calculator.ts` - Score computation
- `audit-logger.ts` - Activity tracking

### 6. Shared Utilities Module
**Location**: `src/shared/`

**Responsibilities**:
- Authentication & authorization
- Database connections
- Error handling
- Logging
- Configuration
- Validation schemas
- Common types

**Key Components**:
- `auth/` - Authentication middleware
- `db/` - Database clients and migrations
- `errors/` - Custom error classes
- `logger.ts` - Structured logging
- `config.ts` - Environment configuration
- `types/` - TypeScript types

---

## Data Models

### Core Entities

#### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  institution_id: string;
  created_at: timestamp;
  updated_at: timestamp;
}
```

#### Assignment
```typescript
interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description: string;
  rubric_id?: string;
  due_date: timestamp;
  similarity_check_enabled: boolean;
  ai_detection_enabled: boolean;
  created_by: string; // teacher user_id
  created_at: timestamp;
  updated_at: timestamp;
}
```

#### Submission
```typescript
interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_id: string;
  submitted_at: timestamp;
  version: number;
  status: 'submitted' | 'processing' | 'graded' | 'returned';
}
```

#### Document
```typescript
interface Document {
  id: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
  format: string; // PDF, DOCX, etc.
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  preview_url?: string;
  text_content?: string;
  page_count?: number;
  metadata: Record<string, any>;
  uploaded_at: timestamp;
}
```

#### Annotation
```typescript
interface Annotation {
  id: string;
  document_id: string;
  submission_id: string;
  created_by: string; // user_id
  type: 'highlight' | 'comment' | 'drawing' | 'sticky_note';
  page: number;
  coordinates: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width?: number;
    height?: number;
  };
  content?: string; // for comments
  color?: string;
  stroke_data?: string; // for drawings
  is_draft: boolean;
  created_at: timestamp;
  updated_at: timestamp;
}
```

#### SimilarityReport
```typescript
interface SimilarityReport {
  id: string;
  submission_id: string;
  overall_similarity: number; // percentage 0-100
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sources: SimilaritySource[];
  excluded_matches: ExcludedMatch[];
  generated_at: timestamp;
}

interface SimilaritySource {
  id: string;
  source_name: string;
  source_url?: string;
  similarity_percentage: number;
  matched_passages: MatchedPassage[];
}

interface MatchedPassage {
  submission_text: string;
  source_text: string;
  start_position: number;
  end_position: number;
  match_type: 'exact' | 'near_match';
}
```

#### AIDetectionReport
```typescript
interface AIDetectionReport {
  id: string;
  submission_id: string;
  overall_score: number; // 0-100 likelihood of AI-generated
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  passages: AIDetectionPassage[];
  model_version: string;
  generated_at: timestamp;
}

interface AIDetectionPassage {
  text: string;
  start_position: number;
  end_position: number;
  ai_likelihood: number; // 0-100
  classification: 'ai_generated' | 'ai_paraphrased' | 'human_written' | 'uncertain';
}
```

#### Grade
```typescript
interface Grade {
  id: string;
  submission_id: string;
  graded_by: string; // teacher user_id
  score: number;
  max_score: number;
  rubric_scores?: Record<string, number>;
  feedback: string;
  is_draft: boolean;
  published_at?: timestamp;
  created_at: timestamp;
  updated_at: timestamp;
}
```

---

## API Contracts

### Document API
```
POST   /api/documents/upload
GET    /api/documents/:id
GET    /api/documents/:id/preview
GET    /api/documents/:id/download
GET    /api/documents/:id/text
DELETE /api/documents/:id
```

### Annotation API
```
POST   /api/annotations
GET    /api/annotations?submission_id=:id
GET    /api/annotations/:id
PUT    /api/annotations/:id
DELETE /api/annotations/:id
POST   /api/annotations/export/:submission_id
```

### Submission API
```
POST   /api/submissions
GET    /api/submissions/:id
GET    /api/submissions?assignment_id=:id
PUT    /api/submissions/:id
GET    /api/submissions/:id/versions
```

### Grading API
```
POST   /api/grades
GET    /api/grades/:id
PUT    /api/grades/:id
POST   /api/grades/:id/publish
GET    /api/grades?submission_id=:id
```

### Similarity API
```
POST   /api/similarity/check/:submission_id
GET    /api/similarity/reports/:id
GET    /api/similarity/reports/:id/sources
POST   /api/similarity/reports/:id/exclude
PUT    /api/similarity/reports/:id/recalculate
```

### AI Detection API
```
POST   /api/ai-detection/check/:submission_id
GET    /api/ai-detection/reports/:id
GET    /api/ai-detection/reports/:id/passages
```

---

## Technology Stack

### Frontend
- **Framework**: React 19.2.8
- **Language**: TypeScript 6.0.2
- **Build**: Vite 8.3.0
- **UI Components**: TBD (Material-UI, Ant Design, or custom)
- **State Management**: React Context + Hooks (or Redux if needed)
- **HTTP Client**: Axios
- **WebSocket**: Socket.io client

### Backend
- **Runtime**: Node.js 24.22.0
- **Framework**: Express 4.18.2
- **Language**: TypeScript 5.3.3
- **Database**: PostgreSQL 16+
- **ORM**: Prisma or TypeORM
- **Job Queue**: BullMQ + Redis
- **WebSocket**: Socket.io server
- **Authentication**: JWT + bcrypt

### Document Processing
- **PDF**: pdf-lib, pdfjs-dist
- **Word**: mammoth, docx
- **Spreadsheets**: xlsx, exceljs
- **Images**: sharp
- **OCR**: tesseract.js or Google Cloud Vision API
- **Format Detection**: file-type, magic-bytes

### Search & Indexing
- **Full-text**: PostgreSQL full-text search or Elasticsearch
- **Vector Search**: pgvector (for semantic similarity if needed)

### AI/ML
- **AI Detection**: OpenAI API, GPTZero API, or transformers.js
- **Text Processing**: natural, compromise

### Testing
- **Unit**: Jest
- **E2E**: Playwright 1.64.1
- **API**: Supertest
- **Mocking**: MSW

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose (development)
- **CI/CD**: GitHub Actions
- **Monitoring**: TBD (Prometheus, Grafana, or Sentry)

---

## Deployment Architecture

### Development
```
localhost:5173 (Frontend - Vite dev server)
localhost:3001 (Backend - Express)
localhost:5432 (PostgreSQL)
localhost:6379 (Redis)
```

### Production (Future)
```
┌──────────┐
│  Client  │
└────┬─────┘
     │ HTTPS
┌────▼──────────────┐
│  Load Balancer    │
│  (nginx/Caddy)    │
└────┬──────────────┘
     │
 ┌───▼────┐ ┌─────────┐
 │ Web 1  │ │  Web 2  │ (Horizontal scaling)
 └───┬────┘ └────┬────┘
     │           │
 ┌───▼───────────▼───┐
 │   PostgreSQL      │
 │   (Primary)       │
 └───┬───────────────┘
     │
 ┌───▼───────────────┐
 │   Redis           │
 │   (Job Queue)     │
 └───────────────────┘
     │
 ┌───▼───────────────┐
 │  Worker Pool      │
 │  (Background Jobs)│
 └───────────────────┘
     │
 ┌───▼───────────────┐
 │  File Storage     │
 │  (S3/MinIO)       │
 └───────────────────┘
```

---

## Security Architecture

### Authentication
- JWT tokens with refresh mechanism
- HttpOnly cookies for web clients
- CORS protection
- Rate limiting

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Teacher/student/admin roles
- Institution isolation

### File Security
- Content-based validation
- Virus scanning (ClamAV or VirusTotal API)
- Size limits
- Execution prevention (no macro execution)
- Sandboxed processing
- Secure temporary directory handling

### Data Protection
- Encrypted connections (HTTPS, WSS)
- Database encryption at rest
- Sensitive data hashing
- Audit logging
- GDPR compliance considerations

---

## Integration Contracts (Future MySL8TE)

### Authentication Integration
```typescript
interface MySL8TEAuthAdapter {
  validateSession(token: string): Promise<User>;
  createSession(userId: string): Promise<string>;
  revokeSession(token: string): Promise<void>;
}
```

### Data Sync Interface
```typescript
interface MySL8TEDataSync {
  syncCourse(courseId: string): Promise<Course>;
  syncAssignment(assignmentId: string): Promise<Assignment>;
  syncSubmission(submissionId: string): Promise<Submission>;
  pushGrades(grades: Grade[]): Promise<void>;
}
```

### Event Hooks
```typescript
interface MySL8TEEventHooks {
  onSubmissionCreated(submission: Submission): Promise<void>;
  onGradePublished(grade: Grade): Promise<void>;
  onReportGenerated(report: Report): Promise<void>;
}
```

---

## Performance Targets

### Response Times
- Page load: < 2s
- Document preview: < 3s (for typical academic papers)
- Annotation save: < 500ms
- Similarity report: < 60s (for typical submissions)
- AI detection: < 30s (for typical submissions)

### Throughput
- Concurrent users: 100+ (development target)
- Document uploads: 10/sec
- Annotation operations: 100/sec

### Storage
- Document retention: Configurable (default 1 year)
- Database size: Scale to 100k+ submissions
- File storage: Scale to 1TB+

---

## Monitoring & Observability

### Key Metrics
- Request latency (p50, p95, p99)
- Error rates
- Document processing success rate
- Similarity check completion time
- AI detection accuracy (via evaluation)
- Database query performance
- Background job queue depth
- Storage utilization

### Logging
- Structured JSON logs
- Request tracing
- Error tracking
- Audit events
- Performance profiling

---

## Development Workflow

### Branch Strategy
- `main`: Stable, tested code
- `cursor/*-a522`: Feature branches per agent/milestone
- PR-based review and merge

### Testing Strategy
- Unit tests for core logic
- Integration tests for API endpoints
- E2E tests for critical workflows
- Visual regression tests for UI
- Computer-use manual testing for complex interactions

### Documentation
- Inline code comments (non-obvious logic only)
- API documentation (OpenAPI/Swagger)
- Architecture diagrams (Mermaid)
- Feature parity tracking
- Limitations disclosure

---

## Next Steps

1. ✅ Create architecture documentation (this document)
2. [ ] Research phase (Agents 1 & 2)
3. [ ] Refine architecture based on research findings
4. [ ] Set up database schema
5. [ ] Implement Document Engine (Milestone B)
6. [ ] Implement Annotation System (Milestone C)
7. [ ] Implement Grading System (Milestone D)
8. [ ] Implement Similarity Detection (Milestone E)
9. [ ] Implement AI Detection (Milestone F)
10. [ ] Full integration (Milestone G)
11. [ ] Hardening & acceptance (Milestone H)

---

**Status**: Initial Architecture - Subject to Refinement  
**Last Updated**: 2026-10-18  
**Next Review**: After research phase completes
