import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from './db/prisma';
import {
  AuthUser, PASSWORD_MAX_LENGTH, createSession, destroySession, destroyUserSessions, hashPasswordAsync,
  hashToken, passwordPolicyErrors, purgeExpiredSessions, resolveSession, verifyPassword,
} from './services/auth';
import { FailureLimiter, clientAddressKey } from './services/rateLimit';
import { canReadSubmission, loadSubmission, studentView, studiesCourse, teachesCourse } from './services/access';
import { assertMagic, EXTENSION_TO_FORMAT, formatSupport, uploadDir } from './services/extract';
import { buildSimilarityReport } from './services/similarity';
import { REVIEW_DECISIONS, refreshAfterSimilarity } from './services/aiAssessment';
import { renderFeedbackPdf } from './services/pdfExport';
import { COMMENT_MAX_LENGTH, THREAD_MAX_COMMENTS, commentContent, parseStrokeData, strokeBounds, threadDescendants, threadOrder } from './services/annotationInput';
import { markablePages, pageImage } from './services/pageImage';
import { AnnotationType, Prisma } from '@prisma/client';

export interface AuthedRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 26_214_400), files: 1, fields: 20, fieldSize: 64 * 1024 },
});

const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
export const loginLimiters = {
  account: new FailureLimiter(Number(process.env.LOGIN_MAX_FAILURES || 10), LOGIN_WINDOW_MS),
  address: new FailureLimiter(Number(process.env.LOGIN_MAX_FAILURES_PER_IP || 50), LOGIN_WINDOW_MS),
};

export const passwordChangeLimiter = new FailureLimiter(Number(process.env.PASSWORD_CHANGE_MAX_FAILURES || 5), LOGIN_WINDOW_MS);

const EMAIL_MAX_LENGTH = 254;
const INVALID_LOGIN = 'Email or password is incorrect';

function tooManyAttempts(res: Response, retryAfter: number): void {
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({ error: 'Too many attempts. Try again later.' });
}

async function auth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const session = await resolveSession(token);
    if (!session) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    req.user = session.user;
    req.sessionId = session.sessionId;
    next();
  } catch (error) {
    next(error);
  }
}

async function courseMembers(courseId: string): Promise<{ teachers: string[]; students: string[] }> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { teachers: true, students: true },
  });
  return {
    teachers: course?.teachers.map((row) => row.userId) ?? [],
    students: course?.students.map((row) => row.userId) ?? [],
  };
}

type Refusal = { refused: true; status: number; error: string };
const refusal = (status: number, error: string): Refusal => ({ refused: true, status, error });

// Serializes thread writes per annotation so subtree deletes, author checks, and the reply cap see a stable thread.
async function lockAnnotation(tx: Prisma.TransactionClient, id: string): Promise<{ isDraft: boolean } | null> {
  const rows = await tx.$queryRaw<Array<{ is_draft: boolean }>>`SELECT is_draft FROM annotations WHERE id = ${id} FOR UPDATE`;
  return rows[0] ? { isDraft: rows[0].is_draft } : null;
}

async function audit(userId: string | undefined, action: string, entity: string, entityId: string, changes?: unknown): Promise<void> {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, changes: changes ?? undefined } });
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  const trustProxy = process.env.TRUST_PROXY;
  app.set('trust proxy', !trustProxy ? 'loopback'
    : /^\d+$/.test(trustProxy) ? Number(trustProxy)
      : trustProxy === 'true' ? true : trustProxy === 'false' ? false : trustProxy);
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(JSON.stringify({ level: 'info', method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }));
    });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'academic-review-lab', timestamp: new Date().toISOString() });
  });

  app.get('/api/formats', (_req, res) => {
    res.json({
      formats: formatSupport(),
      disclosure: 'nativeEditing is false for every format. Converted previews are not the original layout.',
    });
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password || email.length > EMAIL_MAX_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      const ip = clientAddressKey(req.ip || req.socket.remoteAddress);
      const accountKey = `${ip}|${email}`;
      const retryAfter = Math.max(loginLimiters.address.retryAfterSeconds(ip), loginLimiters.account.retryAfterSeconds(accountKey));
      if (retryAfter > 0) {
        tooManyAttempts(res, retryAfter);
        return;
      }
      // Count the attempt before the slow hash so concurrent guesses cannot all slip under the limit.
      loginLimiters.address.recordFailure(ip);
      loginLimiters.account.recordFailure(accountKey);
      const { user, ok } = await (async () => {
        const found = await prisma.user.findUnique({ where: { email } });
        return { user: found, ok: await verifyPassword(password, found?.passwordHash) };
      })().catch((error) => {
        loginLimiters.address.release(ip);
        loginLimiters.account.release(accountKey);
        throw error;
      });
      if (!user || !ok) {
        await audit(user?.id, 'login_failed', 'user', user?.id ?? 'unknown');
        res.status(401).json({ error: INVALID_LOGIN });
        return;
      }
      loginLimiters.address.release(ip);
      loginLimiters.account.clear(accountKey);
      const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
      const session = await createSession(user.id);
      const current = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
      if (current?.passwordHash !== user.passwordHash) {
        await prisma.session.deleteMany({ where: { tokenHash: hashToken(session.token) } });
        res.status(401).json({ error: INVALID_LOGIN });
        return;
      }
      await audit(user.id, 'login', 'user', user.id);
      purgeExpiredSessions().catch(() => undefined);
      res.json({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: authUser });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', auth, async (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', auth, async (req: AuthedRequest, res, next) => {
    try {
      await destroySession(req.sessionId!);
      await audit(req.user!.id, 'logout', 'user', req.user!.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout-all', auth, async (req: AuthedRequest, res, next) => {
    try {
      const revoked = await destroyUserSessions(req.user!.id);
      await audit(req.user!.id, 'logout_all', 'user', req.user!.id, { revoked });
      res.json({ ok: true, revoked });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/password', auth, async (req: AuthedRequest, res, next) => {
    try {
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!currentPassword || currentPassword.length > PASSWORD_MAX_LENGTH) {
        res.status(400).json({ error: 'Current password is required' });
        return;
      }
      const limiterKey = req.user!.id;
      const retryAfter = passwordChangeLimiter.retryAfterSeconds(limiterKey);
      if (retryAfter > 0) {
        tooManyAttempts(res, retryAfter);
        return;
      }
      passwordChangeLimiter.recordFailure(limiterKey);
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        await audit(req.user!.id, 'password_change_failed', 'user', req.user!.id);
        res.status(403).json({ error: 'Current password is incorrect' });
        return;
      }
      passwordChangeLimiter.release(limiterKey);
      const problems = passwordPolicyErrors(newPassword, { email: user.email, name: user.name });
      if (newPassword === currentPassword) problems.push('Choose a password you have not just used');
      if (problems.length) {
        res.status(400).json({ error: problems.join('. '), details: problems });
        return;
      }
      const written = await prisma.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash: await hashPasswordAsync(newPassword) },
      });
      if (written.count === 0) {
        res.status(409).json({ error: 'The password changed while this request was running. Sign in again.' });
        return;
      }
      const revoked = await destroyUserSessions(user.id, req.sessionId);
      await audit(user.id, 'password_change', 'user', user.id, { revokedOtherSessions: revoked });
      res.json({ ok: true, revokedOtherSessions: revoked });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/notifications', auth, async (req: AuthedRequest, res, next) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      res.json({ notifications });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/notifications/:id/read', auth, async (req: AuthedRequest, res, next) => {
    try {
      const updated = await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user!.id },
        data: { read: true, readAt: new Date() },
      });
      res.json({ updated: updated.count });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/notifications/read-all', auth, async (req: AuthedRequest, res, next) => {
    try {
      const updated = await prisma.notification.updateMany({
        where: { userId: req.user!.id, read: false },
        data: { read: true, readAt: new Date() },
      });
      res.json({ updated: updated.count });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/courses', auth, async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const courses = await prisma.course.findMany({
        where: user.role === 'STUDENT'
          ? { students: { some: { userId: user.id } } }
          : { teachers: { some: { userId: user.id } } },
        include: {
          teachers: { include: { user: { select: { id: true, name: true } } } },
          students: { include: { user: { select: { id: true, name: true, email: true } } } },
          assignments: { select: { id: true, title: true, dueDate: true, maxScore: true } },
        },
        orderBy: { code: 'asc' },
      });
      const visible = user.role === 'STUDENT'
        ? courses.map((course) => ({ ...course, students: course.students.filter((row) => row.userId === user.id) }))
        : courses;
      res.json({ courses: visible });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/courses/:id', auth, async (req: AuthedRequest, res, next) => {
    try {
      const course = await prisma.course.findUnique({
        where: { id: req.params.id },
        include: {
          teachers: { include: { user: { select: { id: true, name: true, email: true } } } },
          students: { include: { user: { select: { id: true, name: true, email: true } } } },
          assignments: { include: { rubric: { include: { criteria: { include: { ratings: true } } } }, submissions: { select: { id: true, studentId: true, status: true, submittedAt: true, version: true } } }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      const member = req.user!.role === 'STUDENT'
        ? course.students.some((row) => row.userId === req.user!.id)
        : course.teachers.some((row) => row.userId === req.user!.id);
      if (!member && req.user!.role !== 'ADMIN') {
        res.status(403).json({ error: 'You are not a member of this course' });
        return;
      }
      if (req.user!.role === 'STUDENT') {
        res.json({
          course: {
            ...course,
            students: course.students.filter((row) => row.userId === req.user!.id),
            assignments: course.assignments.map((assignment) => ({
              ...assignment,
              submissions: assignment.submissions.filter((submission) => submission.studentId === req.user!.id),
            })),
          },
        });
        return;
      }
      res.json({ course });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/courses/:id/assignments', auth, async (req: AuthedRequest, res, next) => {
    try {
      if (req.user!.role === 'STUDENT') {
        res.status(403).json({ error: 'Only teachers can create assignments' });
        return;
      }
      if (!(await teachesCourse(req.user!.id, req.params.id))) {
        res.status(403).json({ error: 'You do not teach this course' });
        return;
      }
      const title = String(req.body.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }
      const criteria = Array.isArray(req.body.criteria) ? req.body.criteria : [];
      const rubric = criteria.length
        ? await prisma.rubric.create({
          data: {
            title: `${title} rubric`,
            totalPoints: criteria.reduce((sum: number, criterion: { points?: number }) => sum + Number(criterion.points || 0), 0),
            criteria: {
              create: criteria.map((criterion: { title: string; description?: string; points: number; ratings?: Array<{ title: string; points: number }> }, index: number) => ({
                title: criterion.title,
                description: criterion.description,
                points: Number(criterion.points),
                order: index + 1,
                ratings: {
                  create: (criterion.ratings || [{ title: 'Full', points: Number(criterion.points) }, { title: 'None', points: 0 }]).map((rating, ratingIndex) => ({
                    title: rating.title,
                    points: Number(rating.points),
                    order: ratingIndex + 1,
                  })),
                },
              })),
            },
          },
        })
        : null;
      const assignment = await prisma.assignment.create({
        data: {
          title,
          description: req.body.description ? String(req.body.description) : null,
          courseId: req.params.id,
          createdById: req.user!.id,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
          maxScore: req.body.maxScore ? Number(req.body.maxScore) : rubric?.totalPoints ?? 100,
          rubricId: rubric?.id,
          similarityCheckEnabled: true,
        },
      });
      const students = await prisma.courseStudent.findMany({ where: { courseId: req.params.id } });
      if (students.length) {
        await prisma.notification.createMany({
          data: students.map((student) => ({
            userId: student.userId,
            type: 'ASSIGNMENT_CREATED' as const,
            title: 'New assignment',
            message: title,
            relatedEntity: 'assignment',
            relatedEntityId: assignment.id,
          })),
        });
      }
      await audit(req.user!.id, 'create', 'assignment', assignment.id);
      res.status(201).json({ assignment });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/assignments/:id/submissions', auth, upload.single('file'), async (req: AuthedRequest, res, next) => {
    try {
      if (req.user!.role !== 'STUDENT') {
        res.status(403).json({ error: 'Only students can submit work' });
        return;
      }
      const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      if (!(await studiesCourse(req.user!.id, assignment.courseId))) {
        res.status(403).json({ error: 'You are not enrolled in this course' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Choose a file to upload' });
        return;
      }
      const extension = path.extname(req.file.originalname).toLowerCase();
      const format = EXTENSION_TO_FORMAT[extension];
      if (!format) {
        res.status(400).json({ error: `Unsupported file extension: ${extension}` });
        return;
      }
      try {
        assertMagic(req.file.buffer, format);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid file' });
        return;
      }
      const storedFilename = `${uuidv4()}${extension}`;
      await fs.mkdir(uploadDir(), { recursive: true });
      await fs.writeFile(path.join(uploadDir(), storedFilename), req.file.buffer);
      const previous = await prisma.submission.findMany({ where: { assignmentId: assignment.id, studentId: req.user!.id }, orderBy: { version: 'desc' }, take: 1 });
      const document = await prisma.document.create({
        data: {
          originalFilename: path.basename(req.file.originalname),
          storedFilename,
          mimeType: req.file.mimetype || 'application/octet-stream',
          fileSize: req.file.size,
          format,
          processingStatus: 'PENDING',
        },
      });
      const submission = await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: req.user!.id,
          documentId: document.id,
          version: (previous[0]?.version ?? 0) + 1,
          status: 'PROCESSING',
        },
      });
      await prisma.processingJob.create({
        data: { submissionId: submission.id, type: 'PROCESS_DOCUMENT', payload: { documentId: document.id, submissionId: submission.id } },
      });
      await audit(req.user!.id, 'submit', 'submission', submission.id);
      res.status(201).json({ submissionId: submission.id });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/submissions/:id', auth, async (req: AuthedRequest, res, next) => {
    try {
      const submission = await loadSubmission(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      const members = await courseMembers(submission.assignment.courseId);
      if (!canReadSubmission(req.user!, submission, members.teachers, members.students)) {
        res.status(403).json({ error: 'You cannot view this submission' });
        return;
      }
      const siblings = req.user!.role === 'STUDENT'
        ? []
        : await prisma.submission.findMany({
          where: { assignmentId: submission.assignmentId },
          orderBy: [{ student: { name: 'asc' } }, { version: 'desc' }],
          include: { student: { select: { id: true, name: true } } },
        });
      res.json({ submission: studentView(req.user!, submission), navigation: siblings, markablePages: markablePages(submission.document) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/documents/:id/file', auth, async (req: AuthedRequest, res, next) => {
    try {
      const document = await prisma.document.findUnique({ where: { id: req.params.id }, include: { submissions: true } });
      if (!document || !document.submissions[0]) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      const submission = await loadSubmission(document.submissions[0].id);
      if (!submission) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      const members = await courseMembers(submission.assignment.courseId);
      if (!canReadSubmission(req.user!, submission, members.teachers, members.students)) {
        res.status(403).json({ error: 'You cannot download this file' });
        return;
      }
      const filePath = path.join(uploadDir(), document.storedFilename);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename.replace(/"/g, '')}"`);
      res.type(document.mimeType);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/submissions/:id/annotations', auth, async (req: AuthedRequest, res, next) => {
    try {
      if (req.user!.role === 'STUDENT') {
        res.status(403).json({ error: 'Students cannot create instructor annotations' });
        return;
      }
      const submission = await loadSubmission(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      if (!(await teachesCourse(req.user!.id, submission.assignment.courseId))) {
        res.status(403).json({ error: 'You do not teach this course' });
        return;
      }
      const type = String(req.body.type || 'HIGHLIGHT') as AnnotationType;
      const percent = (value: unknown) => (value === undefined || value === null ? null : Number(value));
      let coords = { x: percent(req.body.x) ?? 0, y: percent(req.body.y) ?? 0, width: percent(req.body.width), height: percent(req.body.height) };
      const page = req.body.page === undefined ? 1 : Number(req.body.page);
      if (!Object.values(AnnotationType).includes(type)
        || !Number.isInteger(page) || page < 1 || page > 100_000
        || Object.values(coords).some((value) => value !== null && !(Number.isFinite(value) && value >= 0 && value <= 100))) {
        res.status(400).json({ error: 'Annotation type, page, or position is not valid' });
        return;
      }
      const content = req.body.content === undefined || req.body.content === null || req.body.content === '' ? null : commentContent(req.body.content);
      if (content === null && req.body.content !== undefined && req.body.content !== null && req.body.content !== '') {
        res.status(400).json({ error: `Comments must be text of at most ${COMMENT_MAX_LENGTH} characters` });
        return;
      }
      const color = req.body.color === undefined || req.body.color === null ? '#f2c14e' : String(req.body.color);
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        res.status(400).json({ error: 'Color must be a #rrggbb value' });
        return;
      }
      let strokeData: string | null = null;
      if (type === 'FREE_DRAW') {
        const strokes = parseStrokeData(req.body.strokeData);
        if ('error' in strokes) {
          res.status(400).json({ error: strokes.error });
          return;
        }
        strokeData = JSON.stringify(strokes.paths);
        coords = strokeBounds(strokes.paths);
      } else if (req.body.strokeData !== undefined && req.body.strokeData !== null) {
        res.status(400).json({ error: 'Only drawings carry stroke data' });
        return;
      }
      if (type === 'AREA' && (req.body.width !== undefined || req.body.height !== undefined)
        && !(coords.width && coords.height && coords.x + coords.width <= 100 && coords.y + coords.height <= 100)) {
        res.status(400).json({ error: 'An area needs a positive width and height inside the page' });
        return;
      }
      if (coords.x + (coords.width ?? 0) > 100 || coords.y + (coords.height ?? 0) > 100) {
        res.status(400).json({ error: 'The annotation must fit inside the page' });
        return;
      }
      if (req.body.anchor !== undefined && JSON.stringify(req.body.anchor).length > 2000) {
        res.status(400).json({ error: 'The annotation anchor is too large' });
        return;
      }
      if ((type === 'FREE_DRAW' || (type === 'AREA' && req.body.width !== undefined)) && page > markablePages(submission.document)) {
        res.status(400).json({ error: 'That page cannot be drawn on for this file' });
        return;
      }
      const annotation = await prisma.annotation.create({
        data: {
          documentId: submission.documentId,
          submissionId: submission.id,
          createdById: req.user!.id,
          type,
          page,
          ...coords,
          content,
          color,
          strokeData,
          anchor: req.body.anchor ?? undefined,
          isDraft: true,
        },
      });
      await audit(req.user!.id, 'annotate', 'annotation', annotation.id);
      res.status(201).json({ annotation });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/annotations/:id', auth, async (req: AuthedRequest, res, next) => {
    try {
      const annotation = await prisma.annotation.findUnique({ where: { id: req.params.id }, include: { submission: { include: { assignment: true } } } });
      if (!annotation) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }
      if (!(await teachesCourse(req.user!.id, annotation.submission.assignment.courseId))) {
        res.status(403).json({ error: 'You cannot delete this annotation' });
        return;
      }
      const removed = await prisma.$transaction(async (tx) => {
        if (!(await lockAnnotation(tx, annotation.id))) return null;
        const comments = await tx.comment.findMany({ where: { annotationId: annotation.id }, select: { id: true, createdById: true, content: true } });
        await tx.comment.deleteMany({ where: { annotationId: annotation.id } });
        await tx.annotation.delete({ where: { id: annotation.id } });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id, action: 'delete_annotation', entity: 'annotation', entityId: annotation.id,
            changes: { submissionId: annotation.submissionId, type: annotation.type, content: annotation.content, removedComments: comments },
          },
        });
        return comments;
      });
      if (!removed) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }
      res.json({ deleted: true, removedComments: removed.length });
    } catch (error) {
      next(error);
    }
  });

  // Teachers reply on any annotation (draft until feedback is published); the submitting student replies
  // only on published annotations, and their replies are visible to the teacher at once.
  app.post('/api/annotations/:id/comments', auth, async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const annotation = await prisma.annotation.findUnique({
        where: { id: req.params.id },
        include: { submission: { include: { assignment: true } } },
      });
      const courseId = annotation?.submission.assignment.courseId ?? '';
      const asTeacher = Boolean(annotation) && user.role === 'TEACHER' && await teachesCourse(user.id, courseId);
      const asStudent = Boolean(annotation) && user.role === 'STUDENT' && annotation!.submission.studentId === user.id
        && !annotation!.isDraft && await studiesCourse(user.id, courseId);
      if (!annotation || (!asTeacher && !asStudent)) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }
      const content = commentContent(req.body?.content);
      if (!content) {
        res.status(400).json({ error: `A reply of 1 to ${COMMENT_MAX_LENGTH} characters is required` });
        return;
      }
      const parentId = req.body?.parentId === undefined || req.body?.parentId === null ? null : String(req.body.parentId);
      const result = await prisma.$transaction(async (tx) => {
        const locked = await lockAnnotation(tx, annotation.id);
        if (!locked || (asStudent && locked.isDraft)) return refusal(404, 'Annotation not found');
        const thread = await tx.comment.findMany({ where: { annotationId: annotation.id }, select: { id: true, isDraft: true } });
        if (parentId) {
          const parent = thread.find((comment) => comment.id === parentId);
          if (!parent || (asStudent && parent.isDraft)) return refusal(400, 'The reply must answer a comment on this annotation');
        }
        if (thread.length >= THREAD_MAX_COMMENTS) return refusal(409, `This thread already has ${THREAD_MAX_COMMENTS} replies`);
        const isDraft = asTeacher ? locked.isDraft : false;
        const comment = await tx.comment.create({
          data: {
            annotationId: annotation.id,
            submissionId: annotation.submissionId,
            createdById: user.id,
            content,
            parentId,
            isDraft,
            publishedAt: isDraft ? null : new Date(),
          },
          include: { createdBy: { select: { id: true, name: true, role: true } } },
        });
        await tx.auditLog.create({ data: { userId: user.id, action: 'comment', entity: 'comment', entityId: comment.id, changes: { annotationId: annotation.id, parentId, isDraft } } });
        return { comment, isDraft };
      });
      if ('refused' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      const { comment, isDraft } = result;
      const recipients = asStudent ? (await courseMembers(courseId)).teachers : isDraft ? [] : [annotation.submission.studentId];
      if (recipients.length) {
        await prisma.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            type: 'COMMENT_ADDED' as const,
            title: asStudent ? `${user.name} replied to feedback` : 'New reply on your feedback',
            message: annotation.submission.assignment.title,
            relatedEntity: 'submission',
            relatedEntityId: annotation.submissionId,
          })),
        });
      }
      res.status(201).json({ comment });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/comments/:id', auth, async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const comment = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { annotation: { include: { submission: { include: { assignment: true } } } } } });
      const courseId = comment?.annotation?.submission.assignment.courseId;
      const teacher = Boolean(courseId) && user.role === 'TEACHER' && await teachesCourse(user.id, courseId!);
      const owner = Boolean(courseId) && comment?.createdById === user.id && user.role === 'STUDENT'
        && comment.annotation?.submission.studentId === user.id && await studiesCourse(user.id, courseId!);
      if (!comment || !comment.annotationId || (!teacher && !owner)) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
      const annotationId = comment.annotationId;
      const result = await prisma.$transaction(async (tx) => {
        await lockAnnotation(tx, annotationId);
        const thread = await tx.comment.findMany({ where: { annotationId }, select: { id: true, parentId: true, createdById: true } });
        if (!thread.some((row) => row.id === comment.id)) return refusal(404, 'Comment not found');
        const ids = threadDescendants(comment.id, thread);
        if (!teacher && thread.some((row) => ids.includes(row.id) && row.createdById !== user.id)) {
          return refusal(409, 'This comment has replies, so only the teacher can remove it');
        }
        await tx.comment.deleteMany({ where: { id: { in: ids } } });
        await tx.auditLog.create({ data: { userId: user.id, action: 'delete_comment', entity: 'comment', entityId: comment.id, changes: { annotationId, removed: ids.length, content: comment.content } } });
        return { ids };
      });
      if ('refused' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ deleted: result.ids.length });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/documents/:id/pages/:page', auth, async (req: AuthedRequest, res, next) => {
    try {
      const document = await prisma.document.findUnique({ where: { id: req.params.id }, include: { submissions: { select: { id: true }, take: 1 } } });
      const submission = document?.submissions[0] ? await loadSubmission(document.submissions[0].id) : null;
      if (!document || !submission) {
        res.status(404).json({ error: 'Page not found' });
        return;
      }
      const members = await courseMembers(submission.assignment.courseId);
      if (!canReadSubmission(req.user!, submission, members.teachers, members.students)) {
        res.status(403).json({ error: 'You cannot view this file' });
        return;
      }
      if (document.processingStatus !== 'COMPLETED') {
        res.status(409).json({ error: 'The file is still being processed' });
        return;
      }
      const image = await pageImage(document, Number(req.params.page)).catch(() => undefined);
      if (image === undefined) {
        res.status(422).json({ error: 'This page could not be rendered' });
        return;
      }
      if (!image) {
        res.status(404).json({ error: 'Page not found' });
        return;
      }
      res.type(image.contentType).sendFile(image.filePath);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/submissions/:id/grade', auth, async (req: AuthedRequest, res, next) => {
    try {
      if (req.user!.role === 'STUDENT') {
        res.status(403).json({ error: 'Students cannot grade submissions' });
        return;
      }
      const submission = await loadSubmission(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      if (!(await teachesCourse(req.user!.id, submission.assignment.courseId))) {
        res.status(403).json({ error: 'You do not teach this course' });
        return;
      }
      const publish = Boolean(req.body.publish);
      const score = Number(req.body.score);
      const maxScore = Number(req.body.maxScore ?? submission.assignment.maxScore ?? 100);
      if (!Number.isFinite(score) || score < 0 || score > maxScore) {
        res.status(400).json({ error: 'Score must be between 0 and the maximum' });
        return;
      }
      const grade = await prisma.grade.upsert({
        where: { submissionId: submission.id },
        update: {
          score,
          maxScore,
          feedback: req.body.feedback ? String(req.body.feedback) : null,
          rubricScores: req.body.rubricScores ?? undefined,
          gradedById: req.user!.id,
          isDraft: !publish,
          publishedAt: publish ? new Date() : null,
        },
        create: {
          submissionId: submission.id,
          gradedById: req.user!.id,
          score,
          maxScore,
          feedback: req.body.feedback ? String(req.body.feedback) : null,
          rubricScores: req.body.rubricScores ?? undefined,
          isDraft: !publish,
          publishedAt: publish ? new Date() : null,
        },
      });
      if (publish) {
        await prisma.annotation.updateMany({ where: { submissionId: submission.id, isDraft: true }, data: { isDraft: false, publishedAt: new Date() } });
        await prisma.comment.updateMany({ where: { submissionId: submission.id, isDraft: true }, data: { isDraft: false, publishedAt: new Date() } });
        await prisma.submission.update({ where: { id: submission.id }, data: { status: 'RETURNED' } });
        await prisma.notification.create({
          data: {
            userId: submission.studentId,
            type: 'GRADE_PUBLISHED',
            title: 'Feedback published',
            message: `${submission.assignment.title} has published feedback.`,
            relatedEntity: 'submission',
            relatedEntityId: submission.id,
          },
        });
      }
      await audit(req.user!.id, publish ? 'publish-grade' : 'save-draft-grade', 'grade', grade.id);
      res.json({ grade });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/submissions/:id/similarity/recalculate', auth, async (req: AuthedRequest, res, next) => {
    try {
      const submission = await loadSubmission(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      if (!(await teachesCourse(req.user!.id, submission.assignment.courseId))) {
        res.status(403).json({ error: 'Only the teacher can recalculate similarity' });
        return;
      }
      const body = req.body ?? {};
      const flags = ['excludeQuotes', 'excludeBibliography', 'excludeSmallMatches'] as const;
      const badFlag = flags.find((flag) => body[flag] !== undefined && typeof body[flag] !== 'boolean');
      if (badFlag) {
        res.status(400).json({ error: `${badFlag} must be true or false` });
        return;
      }
      const threshold = body.smallMatchThreshold === undefined ? 8 : body.smallMatchThreshold;
      if (!Number.isInteger(threshold) || threshold < 1 || threshold > 200) {
        res.status(400).json({ error: 'smallMatchThreshold must be a whole number from 1 to 200' });
        return;
      }
      const similarity = await buildSimilarityReport(submission.id, {
        excludeQuotes: body.excludeQuotes ?? true,
        excludeBibliography: body.excludeBibliography ?? true,
        excludeSmallMatches: body.excludeSmallMatches ?? true,
        smallMatchThreshold: threshold,
      });
      const aiAssessmentRefreshed = await refreshAfterSimilarity(submission.id, submission.document.textContent ?? '', similarity);
      const report = await prisma.similarityReport.findUnique({
        where: { submissionId: submission.id },
        include: {
          sources: { include: { passages: { orderBy: { startPosition: 'asc' } } }, orderBy: { similarityPercentage: 'desc' } },
          excludedMatches: true,
        },
      });
      await audit(req.user!.id, 'similarity_recalculate', 'submission', submission.id, {
        excludeQuotes: report?.excludeQuotes, excludeBibliography: report?.excludeBibliography,
        excludeSmallMatches: report?.excludeSmallMatches, smallMatchThreshold: report?.smallMatchThreshold, aiAssessmentRefreshed,
      });
      res.json({ report, aiAssessmentRefreshed, disclosure: 'Similarity is an overlap percentage against the lab corpus and other submissions in this assignment. It is not proof of plagiarism and it is not a Turnitin score.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/submissions/:id/ai-assessment/review', auth, async (req: AuthedRequest, res, next) => {
    try {
      const submission = await loadSubmission(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      if (!(await teachesCourse(req.user!.id, submission.assignment.courseId))) {
        res.status(403).json({ error: 'Only the teacher can review a writing-signal assessment' });
        return;
      }
      if (submission.aiAssessment?.status !== 'COMPLETED') {
        res.status(409).json({ error: 'The assessment is not ready yet' });
        return;
      }
      const decision = String(req.body?.decision ?? '');
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      if (!(REVIEW_DECISIONS as readonly string[]).includes(decision)) {
        res.status(400).json({ error: `decision must be one of ${REVIEW_DECISIONS.join(', ')}` });
        return;
      }
      if (note.length < 10 || note.length > 4000) {
        res.status(400).json({ error: 'A review note of 10 to 4000 characters is required' });
        return;
      }
      const written = await prisma.aiAssessment.updateMany({
        where: { submissionId: submission.id, updatedAt: submission.aiAssessment.updatedAt },
        data: { reviewDecision: decision, reviewNote: note, reviewedById: req.user!.id, reviewedAt: new Date() },
      });
      if (written.count === 0) {
        res.status(409).json({ error: 'The assessment changed while you were reviewing it. Reload and review again.' });
        return;
      }
      const reviewed = await prisma.aiAssessment.findUnique({
        where: { submissionId: submission.id },
        include: { reviewedBy: { select: { id: true, name: true } } },
      });
      await audit(req.user!.id, 'ai_review', 'submission', submission.id, { decision, note });
      res.json({ aiAssessment: reviewed });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/submissions/:id/export', auth, async (req: AuthedRequest, res, next) => {
    try {
      const submission = await loadSubmission(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found' });
        return;
      }
      const members = await courseMembers(submission.assignment.courseId);
      if (!canReadSubmission(req.user!, submission, members.teachers, members.students)) {
        res.status(403).json({ error: 'You cannot export this submission' });
        return;
      }
      const visible = studentView(req.user!, submission);
      let originalPdf: Uint8Array | null = null;
      if (submission.document.format === 'PDF') {
        originalPdf = await fs.readFile(path.join(uploadDir(), submission.document.storedFilename)).catch(() => null);
      }
      const pdf = await renderFeedbackPdf({
        assignmentTitle: submission.assignment.title,
        courseCode: submission.assignment.course.code,
        studentName: submission.student.name,
        version: submission.version,
        submittedAt: submission.submittedAt,
        fileName: submission.document.originalFilename,
        format: submission.document.format,
        text: submission.document.textContent,
        originalPdf,
        grade: visible.grade
          ? { ...visible.grade, rubricScores: (visible.grade.rubricScores as Record<string, number> | null) ?? null }
          : null,
        rubric: (submission.assignment.rubric?.criteria ?? []).map((criterion) => ({
          id: criterion.id,
          title: criterion.title,
          points: criterion.points,
          ratings: criterion.ratings.map((rating) => ({ title: rating.title, points: rating.points })),
        })),
        annotations: visible.annotations.map((annotation) => ({
          ...annotation,
          authorName: annotation.createdBy.name,
          replies: threadOrder(annotation.comments)
            .map((comment) => ({ authorName: comment.createdBy.name, content: comment.content, isDraft: comment.isDraft, depth: comment.depth })),
        })),
      });
      await audit(req.user!.id, 'export_feedback', 'submission', submission.id);
      const base = submission.assignment.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'submission';
      res.setHeader('Content-Disposition', `attachment; filename="feedback-${base}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/pdf').send(Buffer.from(pdf));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error: Error & { type?: string; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON body' });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large' });
      return;
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FIELD_VALUE';
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'The upload is larger than the allowed size' : 'The upload request is not valid' });
      return;
    }
    console.error(JSON.stringify({ level: 'error', message: error.message }));
    res.status(500).json({ error: 'The server could not complete that request' });
  });

  return app;
}
