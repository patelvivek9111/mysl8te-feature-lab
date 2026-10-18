import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireUser } from '../auth/auth';
import { loadAssignment, loadSubmission, requireGrader, type SubmissionAccess } from '../auth/permissions';
import { HttpError, ah, badRequest, forbidden, notFound, num, param, str } from '../http';
import { detectFormat, extractContent, SUPPORTED_EXTENSIONS, UnsupportedFormatError } from '../documents/processing';
import { assignmentDto, loadRubric } from './courses';
import { audit } from '../audit';
import { transaction, type DB } from '../db/database';
import { runAutomaticChecks } from '../integrity/service';
import { renderFeedbackExport } from '../documents/export';
import { renderAnnotatedPdf } from '../documents/pdfExport';

export interface SubmissionRouterConfig { uploadDir: string; maxFileSize: number }

const ANNOTATION_TYPES = ['point', 'highlight', 'strikeout', 'area', 'freedraw', 'freetext'] as const;
type AnnotationType = (typeof ANNOTATION_TYPES)[number];

interface AnnotationRow {
  id: string; submission_id: string; author_id: string; type: AnnotationType; page: number; coords_json: string;
  color: string; content: string; published: number; created_at: string; updated_at: string;
}

const frac = (v: unknown, field: string) => num(v, field, { min: 0, max: 1 })!;

function rect(r: Record<string, unknown>, field: string) {
  const out = { x: frac(r?.x, `${field}.x`), y: frac(r?.y, `${field}.y`), w: frac(r?.w, `${field}.w`), h: frac(r?.h, `${field}.h`) };
  if (out.x + out.w > 1.0001 || out.y + out.h > 1.0001) throw badRequest(`${field} extends beyond the page`);
  return out;
}

/** Coordinates are page-relative fractions (0..1) so annotations stay aligned at any zoom level or viewport size. */
export function validateCoords(type: AnnotationType, coords: unknown): unknown {
  const c = (coords ?? {}) as Record<string, unknown>;
  switch (type) {
    case 'point':
      return { x: frac(c.x, 'coords.x'), y: frac(c.y, 'coords.y') };
    case 'area':
    case 'freetext':
      return rect(c, 'coords');
    case 'highlight':
    case 'strikeout': {
      if (!Array.isArray(c.rects) || c.rects.length === 0 || c.rects.length > 200) throw badRequest('coords.rects must be a non-empty array');
      return { rects: c.rects.map((r: Record<string, unknown>, i: number) => rect(r, `coords.rects[${i}]`)) };
    }
    case 'freedraw': {
      if (!Array.isArray(c.paths) || c.paths.length === 0 || c.paths.length > 100) throw badRequest('coords.paths must be a non-empty array');
      let total = 0;
      const paths = c.paths.map((p: unknown, i: number) => {
        if (!Array.isArray(p) || p.length < 2) throw badRequest(`coords.paths[${i}] needs at least 2 points`);
        total += p.length;
        return p.map((pt: Record<string, unknown>, j: number) => ({ x: frac(pt?.x, `coords.paths[${i}][${j}].x`), y: frac(pt?.y, `coords.paths[${i}][${j}].y`) }));
      });
      if (total > 10000) throw badRequest('freedraw annotation has too many points');
      return { paths };
    }
  }
}

function annotationDto(db: DB, a: AnnotationRow) {
  const replies = db.prepare(
    'SELECT r.id, r.body, r.created_at AS createdAt, r.author_id AS authorId, u.name AS authorName FROM annotation_replies r JOIN users u ON u.id = r.author_id WHERE r.annotation_id = ? ORDER BY r.created_at',
  ).all(a.id);
  const author = db.prepare('SELECT name FROM users WHERE id = ?').get(a.author_id) as { name: string };
  return {
    id: a.id, submissionId: a.submission_id, authorId: a.author_id, authorName: author.name, type: a.type, page: a.page,
    coords: JSON.parse(a.coords_json), color: a.color, content: a.content, published: !!a.published,
    createdAt: a.created_at, updatedAt: a.updated_at, replies,
  };
}

export function visibleAnnotations(db: DB, access: SubmissionAccess, userId: string) {
  const rows = access.role === 'teacher'
    ? db.prepare('SELECT * FROM annotations WHERE submission_id = ? ORDER BY page, created_at').all(access.submission.id)
    : db.prepare('SELECT * FROM annotations WHERE submission_id = ? AND (published = 1 OR author_id = ?) ORDER BY page, created_at').all(access.submission.id, userId);
  return (rows as unknown as AnnotationRow[]).map((r) => annotationDto(db, r));
}

function loadAnnotation(db: DB, user: { id: string } & Parameters<typeof loadSubmission>[1], annotationId: string) {
  const row = db.prepare('SELECT * FROM annotations WHERE id = ?').get(annotationId) as AnnotationRow | undefined;
  if (!row) throw notFound('Annotation not found');
  const access = loadSubmission(db, user, row.submission_id);
  if (access.role === 'student' && !row.published && row.author_id !== user.id) throw notFound('Annotation not found');
  return { row, access };
}

export function visibleGrade(db: DB, access: SubmissionAccess) {
  const g = db.prepare('SELECT * FROM grades WHERE submission_id = ?').get(access.submission.id) as
    | { score: number | null; rubric_scores_json: string; feedback: string; status: string; updated_at: string; published_at: string | null; grader_id: string } | undefined;
  if (!g) return null;
  if (access.role === 'student' && g.status !== 'published') return null;
  return { score: g.score, rubricScores: JSON.parse(g.rubric_scores_json), feedback: g.feedback, status: g.status, updatedAt: g.updated_at, publishedAt: g.published_at };
}

export function visibleComments(db: DB, access: SubmissionAccess, userId: string) {
  const sql = `SELECT c.id, c.body, c.published, c.created_at AS createdAt, c.author_id AS authorId, u.name AS authorName
               FROM submission_comments c JOIN users u ON u.id = c.author_id WHERE c.submission_id = ?`;
  const rows = access.role === 'teacher'
    ? db.prepare(`${sql} ORDER BY c.created_at`).all(access.submission.id)
    : db.prepare(`${sql} AND (c.published = 1 OR c.author_id = ?) ORDER BY c.created_at`).all(access.submission.id, userId);
  return (rows as unknown as { id: string; body: string; published: number; createdAt: string; authorId: string; authorName: string }[]).map((r) => ({ ...r, published: !!r.published }));
}

export function createSubmissionRouter(config: SubmissionRouterConfig): Router {
  const router = Router();
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize, files: 1, fields: 10 } });

  router.post('/assignments/:assignmentId/submissions', (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        return next(new HttpError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${Math.round(config.maxFileSize / 1048576)} MB limit` : err.message));
      }
      next(err);
    });
  }, ah(async (req, res) => {
    const user = requireUser(req);
    const { assignment, role } = loadAssignment(req.db, user, param(req, 'assignmentId'));
    if (role !== 'student') throw forbidden('Only enrolled students can submit');
    const file = req.file;
    if (!file || file.size === 0) throw badRequest('A non-empty file is required (field name "file")');
    const originalName = path.basename(file.originalname).slice(0, 255) || 'upload';
    let spec;
    try {
      spec = detectFormat(file.buffer, originalName);
    } catch (e) {
      if (e instanceof UnsupportedFormatError) throw new HttpError(415, e.message, { supported: SUPPORTED_EXTENSIONS });
      throw e;
    }
    let extraction: Awaited<ReturnType<typeof extractContent>> | null = null;
    let extractionError: string | null = null;
    try {
      extraction = await extractContent(file.buffer, spec.format);
    } catch (e) {
      extractionError = `Could not read this ${spec.format} file: ${(e as Error).message}`.slice(0, 500);
    }
    if (spec.format === 'PDF' && !extraction) throw new HttpError(422, extractionError ?? 'Invalid PDF');

    const docId = crypto.randomUUID();
    const storagePath = path.join(config.uploadDir, docId);
    fs.writeFileSync(storagePath, file.buffer, { mode: 0o600 });
    const sha = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const submissionId = crypto.randomUUID();
    try {
      transaction(req.db, () => {
        req.db.prepare(`INSERT INTO documents (id, owner_id, original_name, mime, format, size, sha256, storage_path, page_count, text, html, extraction_status, extraction_error)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          docId, user.id, originalName, spec.mime, spec.format, file.size, sha, storagePath,
          extraction?.pageCount ?? null, extraction?.text ?? null, extraction?.html ?? null,
          extraction ? extraction.status : 'failed', extractionError ?? extraction?.note ?? null,
        );
        const prev = req.db.prepare('SELECT MAX(attempt) AS n FROM submissions WHERE assignment_id = ? AND student_id = ?').get(assignment.id, user.id) as { n: number | null };
        req.db.prepare('INSERT INTO submissions (id, assignment_id, student_id, attempt, document_id) VALUES (?, ?, ?, ?, ?)')
          .run(submissionId, assignment.id, user.id, (prev.n ?? 0) + 1, docId);
      });
    } catch (e) {
      fs.rmSync(storagePath, { force: true });
      throw e;
    }
    audit(req.db, user.id, 'submit', 'submission', submissionId);
    runAutomaticChecks(req.db, submissionId);
    const access = loadSubmission(req.db, user, submissionId);
    res.status(201).json(submissionDetail(req.db, access, user.id));
  }));

  router.get('/submissions/:submissionId', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    res.json(submissionDetail(req.db, access, user.id));
  }));

  router.get('/submissions/:submissionId/file', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    const doc = req.db.prepare('SELECT mime, original_name, storage_path FROM documents WHERE id = ?').get(access.submission.document_id) as
      { mime: string; original_name: string; storage_path: string };
    if (!fs.existsSync(doc.storage_path)) throw notFound('File is missing from storage');
    res.setHeader('Content-Type', doc.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(doc.storage_path).pipe(res);
  }));

  router.get('/submissions/:submissionId/annotations', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    res.json({ annotations: visibleAnnotations(req.db, access, user.id) });
  }));

  router.post('/submissions/:submissionId/annotations', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    requireGrader(access);
    const type = req.body?.type as AnnotationType;
    if (!ANNOTATION_TYPES.includes(type)) throw badRequest(`type must be one of ${ANNOTATION_TYPES.join(', ')}`);
    const doc = req.db.prepare('SELECT page_count FROM documents WHERE id = ?').get(access.submission.document_id) as { page_count: number | null };
    const page = num(req.body?.page ?? 1, 'page', { min: 1, max: doc.page_count ?? 1 })!;
    if (!Number.isInteger(page)) throw badRequest('page must be an integer');
    const coords = validateCoords(type, req.body?.coords);
    const color = req.body?.color === undefined ? '#f5d90a' : str(req.body.color, 'color');
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw badRequest('color must be a hex color like #ff0000');
    const content = str(req.body?.content, 'content', { max: 10000, optional: true });
    if (type === 'freetext' && !content) throw badRequest('freetext annotations require content');
    const id = crypto.randomUUID();
    req.db.prepare('INSERT INTO annotations (id, submission_id, author_id, type, page, coords_json, color, content, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, access.submission.id, user.id, type, page, JSON.stringify(coords), color, content, isGradePublished(req.db, access.submission.id) ? 1 : 0);
    const row = req.db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as unknown as AnnotationRow;
    res.status(201).json({ annotation: annotationDto(req.db, row) });
  }));

  router.patch('/annotations/:annotationId', ah((req, res) => {
    const user = requireUser(req);
    const { row } = loadAnnotation(req.db, user, param(req, 'annotationId'));
    if (row.author_id !== user.id) throw forbidden('Only the author can edit this annotation');
    const updates: Record<string, string | number> = {};
    if (req.body?.content !== undefined) updates.content = str(req.body.content, 'content', { max: 10000, optional: true });
    if (req.body?.coords !== undefined) updates.coords_json = JSON.stringify(validateCoords(row.type, req.body.coords));
    if (req.body?.color !== undefined) {
      const color = str(req.body.color, 'color');
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw badRequest('color must be a hex color like #ff0000');
      updates.color = color;
    }
    const keys = Object.keys(updates);
    if (keys.length) {
      req.db.prepare(`UPDATE annotations SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
        .run(...Object.values(updates), row.id);
    }
    const updated = req.db.prepare('SELECT * FROM annotations WHERE id = ?').get(row.id) as unknown as AnnotationRow;
    res.json({ annotation: annotationDto(req.db, updated) });
  }));

  router.delete('/annotations/:annotationId', ah((req, res) => {
    const user = requireUser(req);
    const { row, access } = loadAnnotation(req.db, user, param(req, 'annotationId'));
    if (row.author_id !== user.id && access.role !== 'teacher') throw forbidden();
    req.db.prepare('DELETE FROM annotations WHERE id = ?').run(row.id);
    res.json({ ok: true });
  }));

  router.post('/annotations/:annotationId/replies', ah((req, res) => {
    const user = requireUser(req);
    const { row } = loadAnnotation(req.db, user, param(req, 'annotationId'));
    const body = str(req.body?.body, 'body', { min: 1, max: 5000 });
    const id = crypto.randomUUID();
    req.db.prepare('INSERT INTO annotation_replies (id, annotation_id, author_id, body) VALUES (?, ?, ?, ?)').run(id, row.id, user.id, body);
    const updated = req.db.prepare('SELECT * FROM annotations WHERE id = ?').get(row.id) as unknown as AnnotationRow;
    res.status(201).json({ annotation: annotationDto(req.db, updated) });
  }));

  router.post('/submissions/:submissionId/comments', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    const body = str(req.body?.body, 'body', { min: 1, max: 10000 });
    const published = access.role === 'student' || isGradePublished(req.db, access.submission.id) ? 1 : 0;
    const id = crypto.randomUUID();
    req.db.prepare('INSERT INTO submission_comments (id, submission_id, author_id, body, published) VALUES (?, ?, ?, ?, ?)').run(id, access.submission.id, user.id, body, published);
    res.status(201).json({ comments: visibleComments(req.db, access, user.id) });
  }));

  router.put('/submissions/:submissionId/grade', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    requireGrader(access);
    const rubric = loadRubric(req.db, access.assignment.rubric_id);
    let rubricScores: Record<string, { ratingId?: string; points: number; comment?: string }> = {};
    if (req.body?.rubricScores !== undefined) {
      if (!rubric) throw badRequest('This assignment has no rubric');
      const raw = req.body.rubricScores as Record<string, { ratingId?: string; points?: unknown; comment?: unknown }>;
      if (typeof raw !== 'object' || raw === null) throw badRequest('rubricScores must be an object keyed by criterion id');
      for (const [criterionId, v] of Object.entries(raw)) {
        const criterion = rubric.criteria.find((c) => c.id === criterionId);
        if (!criterion) throw badRequest(`Unknown rubric criterion ${criterionId}`);
        let points = num(v?.points, `rubricScores.${criterionId}.points`, { min: 0, max: criterion.points, optional: true });
        if (v?.ratingId) {
          const rating = criterion.ratings.find((r) => r.id === v.ratingId);
          if (!rating) throw badRequest(`Unknown rating for criterion ${criterionId}`);
          points ??= rating.points;
        }
        if (points === null) throw badRequest(`rubricScores.${criterionId} needs points or ratingId`);
        rubricScores[criterionId] = { ratingId: v?.ratingId, points, comment: v?.comment ? str(v.comment, 'comment', { max: 2000 }) : undefined };
      }
    } else {
      const existing = req.db.prepare('SELECT rubric_scores_json FROM grades WHERE submission_id = ?').get(access.submission.id) as { rubric_scores_json: string } | undefined;
      rubricScores = existing ? JSON.parse(existing.rubric_scores_json) : {};
    }
    let score = num(req.body?.score, 'score', { min: 0, max: access.assignment.points_possible * 2, optional: true });
    if (score === null && req.body?.rubricScores !== undefined && rubric) {
      const earned = Object.values(rubricScores).reduce((s, r) => s + r.points, 0);
      score = rubric.pointsPossible > 0 ? Math.round((earned / rubric.pointsPossible) * access.assignment.points_possible * 100) / 100 : 0;
    }
    const feedback = req.body?.feedback !== undefined ? str(req.body.feedback, 'feedback', { max: 20000, optional: true }) : undefined;
    req.db.prepare(`INSERT INTO grades (submission_id, grader_id, score, rubric_scores_json, feedback) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(submission_id) DO UPDATE SET grader_id = excluded.grader_id,
        score = COALESCE(?, grades.score), rubric_scores_json = excluded.rubric_scores_json,
        feedback = COALESCE(?, grades.feedback), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run(access.submission.id, user.id, score, JSON.stringify(rubricScores), feedback ?? '', score, feedback ?? null);
    audit(req.db, user.id, 'grade', 'submission', access.submission.id);
    res.json({ grade: visibleGrade(req.db, access) });
  }));

  router.post('/submissions/:submissionId/grade/publish', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    requireGrader(access);
    const g = req.db.prepare('SELECT score FROM grades WHERE submission_id = ?').get(access.submission.id) as { score: number | null } | undefined;
    if (!g) throw badRequest('Save a grade before publishing');
    transaction(req.db, () => {
      req.db.prepare("UPDATE grades SET status = 'published', published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE submission_id = ?").run(access.submission.id);
      req.db.prepare('UPDATE annotations SET published = 1 WHERE submission_id = ?').run(access.submission.id);
      req.db.prepare('UPDATE submission_comments SET published = 1 WHERE submission_id = ?').run(access.submission.id);
      req.db.prepare("UPDATE submissions SET status = 'graded' WHERE id = ?").run(access.submission.id);
    });
    audit(req.db, user.id, 'publish_grade', 'submission', access.submission.id);
    res.json({ grade: visibleGrade(req.db, access) });
  }));

  router.post('/submissions/:submissionId/grade/unpublish', ah((req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    requireGrader(access);
    transaction(req.db, () => {
      req.db.prepare("UPDATE grades SET status = 'draft', published_at = NULL WHERE submission_id = ?").run(access.submission.id);
      req.db.prepare('UPDATE annotations SET published = 0 WHERE submission_id = ?').run(access.submission.id);
      req.db.prepare('UPDATE submission_comments SET published = 0 WHERE submission_id = ? AND author_id <> ?').run(access.submission.id, access.submission.student_id);
      req.db.prepare("UPDATE submissions SET status = 'submitted' WHERE id = ?").run(access.submission.id);
    });
    audit(req.db, user.id, 'unpublish_grade', 'submission', access.submission.id);
    res.json({ grade: visibleGrade(req.db, access) });
  }));

  router.get('/submissions/:submissionId/export', ah(async (req, res) => {
    const user = requireUser(req);
    const access = loadSubmission(req.db, user, param(req, 'submissionId'));
    const detail = submissionDetail(req.db, access, user.id);
    if (req.query.format === 'pdf') {
      const doc = req.db.prepare('SELECT storage_path FROM documents WHERE id = ?').get(access.submission.document_id) as { storage_path: string };
      const pdf = await renderAnnotatedPdf(detail, doc.storage_path);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="feedback-${access.submission.id}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(Buffer.from(pdf));
    }
    const html = renderFeedbackExport(detail);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Content-Disposition', `attachment; filename="feedback-${access.submission.id}.html"`);
    res.send(html);
  }));

  return router;
}

function isGradePublished(db: DB, submissionId: string): boolean {
  const g = db.prepare('SELECT status FROM grades WHERE submission_id = ?').get(submissionId) as { status: string } | undefined;
  return g?.status === 'published';
}

export function submissionDetail(db: DB, access: SubmissionAccess, userId: string) {
  const s = access.submission;
  const doc = db.prepare('SELECT id, original_name, mime, format, size, page_count, text, html, extraction_status, extraction_error, created_at FROM documents WHERE id = ?')
    .get(s.document_id) as unknown as {
      id: string; original_name: string; mime: string; format: string; size: number; page_count: number | null; text: string | null;
      html: string | null; extraction_status: string; extraction_error: string | null; created_at: string;
    };
  const student = db.prepare('SELECT id, name FROM users WHERE id = ?').get(s.student_id);
  const attempts = db.prepare('SELECT id, attempt, submitted_at AS submittedAt FROM submissions WHERE assignment_id = ? AND student_id = ? ORDER BY attempt').all(s.assignment_id, s.student_id);
  return {
    submission: { id: s.id, assignmentId: s.assignment_id, studentId: s.student_id, attempt: s.attempt, status: s.status, submittedAt: s.submitted_at },
    student,
    attempts,
    role: access.role,
    assignment: assignmentDto(access.assignment, access.role),
    rubric: loadRubric(db, access.assignment.rubric_id),
    document: {
      id: doc.id, fileName: doc.original_name, mime: doc.mime, format: doc.format, size: doc.size, pageCount: doc.page_count,
      text: doc.text, html: doc.html, extractionStatus: doc.extraction_status, extractionNote: doc.extraction_error,
    },
    grade: visibleGrade(db, access),
    comments: visibleComments(db, access, userId),
    annotations: visibleAnnotations(db, access, userId),
  };
}
