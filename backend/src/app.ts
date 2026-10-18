import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from './db/prisma';
import { signToken, verifyPassword, verifyToken, AuthUser } from './services/auth';
import { canReadSubmission, loadSubmission, studentView, studiesCourse, teachesCourse } from './services/access';
import { assertMagic, EXTENSION_TO_FORMAT, formatSupport, uploadDir } from './services/extract';
import { buildSimilarityReport } from './services/similarity';
import { AnnotationType } from '@prisma/client';

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 26_214_400) },
});

function auth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.user = user;
  next();
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

async function audit(userId: string | undefined, action: string, entity: string, entityId: string, changes?: unknown): Promise<void> {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, changes: changes ?? undefined } });
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
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
      const email = String(req.body.email || '').toLowerCase();
      const password = String(req.body.password || '');
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'Email or password is incorrect' });
        return;
      }
      const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
      await audit(user.id, 'login', 'user', user.id);
      res.json({ token: signToken(authUser), user: authUser });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', auth, async (req: AuthedRequest, res) => {
    res.json({ user: req.user });
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
      res.json({ submission: studentView(req.user!, submission), navigation: siblings });
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
      const annotation = await prisma.annotation.create({
        data: {
          documentId: submission.documentId,
          submissionId: submission.id,
          createdById: req.user!.id,
          type,
          page: Number(req.body.page || 1),
          x: Number(req.body.x || 0),
          y: Number(req.body.y || 0),
          width: req.body.width === undefined ? null : Number(req.body.width),
          height: req.body.height === undefined ? null : Number(req.body.height),
          content: req.body.content ? String(req.body.content) : null,
          color: req.body.color ? String(req.body.color) : '#f2c14e',
          strokeData: req.body.strokeData ? String(req.body.strokeData) : null,
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
      await prisma.comment.deleteMany({ where: { annotationId: annotation.id } });
      await prisma.annotation.delete({ where: { id: annotation.id } });
      res.json({ deleted: true });
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
        await prisma.annotation.updateMany({ where: { submissionId: submission.id }, data: { isDraft: false, publishedAt: new Date() } });
        await prisma.comment.updateMany({ where: { submissionId: submission.id }, data: { isDraft: false, publishedAt: new Date() } });
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
      await buildSimilarityReport(submission.id, {
        excludeQuotes: Boolean(req.body.excludeQuotes ?? true),
        excludeBibliography: Boolean(req.body.excludeBibliography ?? true),
        excludeSmallMatches: Boolean(req.body.excludeSmallMatches ?? true),
        smallMatchThreshold: Number(req.body.smallMatchThreshold ?? 8),
      });
      const report = await prisma.similarityReport.findUnique({ where: { submissionId: submission.id }, include: { sources: { include: { passages: true } } } });
      res.json({ report, disclosure: 'Similarity is an overlap percentage against the lab corpus and other submissions in this assignment. It is not proof of plagiarism and it is not a Turnitin score.' });
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
      const lines = [
        `# ${submission.assignment.title}`,
        `Student: ${submission.student.name}`,
        '',
        visible.grade ? `Score: ${visible.grade.score} / ${visible.grade.maxScore}` : 'Score: not published',
        visible.grade?.feedback ? `Feedback: ${visible.grade.feedback}` : '',
        '',
        '## Annotations',
        ...visible.annotations.map((annotation) => `- ${annotation.type}: ${annotation.content || ''} ${JSON.stringify(annotation.anchor ?? {})}`),
        '',
        '## Document text',
        submission.document.textContent || '(no extracted text)',
        '',
        'This export is a text transcript. It is not a pixel-perfect annotated original.',
      ];
      res.setHeader('Content-Disposition', 'attachment; filename="feedback.txt"');
      res.type('text/plain').send(lines.filter((line) => line !== undefined).join('\n'));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: 'error', message: error.message }));
    res.status(500).json({ error: 'The server could not complete that request' });
  });

  return app;
}
