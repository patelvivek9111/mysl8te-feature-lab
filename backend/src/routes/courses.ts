import crypto from 'node:crypto';
import { Router } from 'express';
import { requireRole, requireUser } from '../auth/auth';
import { loadAssignment, requireCourseRole } from '../auth/permissions';
import { HttpError, ah, badRequest, bool, forbidden, notFound, num, param, str } from '../http';
import { audit } from '../audit';
import type { DB } from '../db/database';

const router = Router();

export interface RubricCriterion { id: string; description: string; points: number; ratings: { id: string; label: string; points: number }[] }

export function parseCriteria(raw: unknown): RubricCriterion[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw badRequest('criteria must be a non-empty array (max 50)');
  return raw.map((c, i) => {
    const description = str(c?.description, `criteria[${i}].description`, { max: 500 });
    const points = num(c?.points, `criteria[${i}].points`, { min: 0, max: 10000 })!;
    const ratingsRaw = Array.isArray(c?.ratings) ? c.ratings : [];
    if (ratingsRaw.length > 20) throw badRequest('too many ratings');
    const ratings = ratingsRaw.map((r: { label?: unknown; points?: unknown }, j: number) => ({
      id: crypto.randomUUID(),
      label: str(r?.label, `criteria[${i}].ratings[${j}].label`, { max: 200 }),
      points: num(r?.points, `criteria[${i}].ratings[${j}].points`, { min: 0, max: points })!,
    }));
    return { id: crypto.randomUUID(), description, points, ratings };
  });
}

export function loadRubric(db: DB, rubricId: string | null) {
  if (!rubricId) return null;
  const row = db.prepare('SELECT id, course_id, title, criteria_json FROM rubrics WHERE id = ?').get(rubricId) as
    | { id: string; course_id: string; title: string; criteria_json: string } | undefined;
  if (!row) return null;
  const criteria = JSON.parse(row.criteria_json) as RubricCriterion[];
  return { id: row.id, courseId: row.course_id, title: row.title, criteria, pointsPossible: criteria.reduce((s, c) => s + c.points, 0) };
}

export function assignmentDto(a: import('../auth/permissions').AssignmentRow, role: 'teacher' | 'student' = 'teacher') {
  const dto = {
    id: a.id, courseId: a.course_id, title: a.title, description: a.description, pointsPossible: a.points_possible,
    dueAt: a.due_at, rubricId: a.rubric_id, similarityEnabled: !!a.similarity_enabled,
    studentsSeeSimilarity: !!a.students_see_similarity, aiAssessmentEnabled: !!a.ai_assessment_enabled as boolean | undefined, createdAt: a.created_at,
  };
  if (role === 'student') delete dto.aiAssessmentEnabled;
  return dto;
}

router.get('/courses', ah((req, res) => {
  const user = requireUser(req);
  const rows = req.db.prepare(
    `SELECT c.id, c.name, c.code, e.role FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ? ORDER BY c.created_at`,
  ).all(user.id);
  res.json({ courses: rows });
}));

router.post('/courses', ah((req, res) => {
  const user = requireRole(req, 'teacher', 'admin');
  const name = str(req.body?.name, 'name', { max: 200 });
  const code = str(req.body?.code, 'code', { max: 50 });
  const id = crypto.randomUUID();
  req.db.prepare('INSERT INTO courses (id, name, code, owner_id) VALUES (?, ?, ?, ?)').run(id, name, code, user.id);
  req.db.prepare("INSERT INTO enrollments (course_id, user_id, role) VALUES (?, ?, 'teacher')").run(id, user.id);
  audit(req.db, user.id, 'create', 'course', id);
  res.status(201).json({ course: { id, name, code, role: 'teacher' } });
}));

router.get('/courses/:courseId', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  const role = requireCourseRole(req.db, user, courseId);
  const course = req.db.prepare('SELECT id, name, code FROM courses WHERE id = ?').get(courseId);
  const assignments = (req.db.prepare('SELECT * FROM assignments WHERE course_id = ? ORDER BY created_at').all(courseId) as never[]).map((a) => assignmentDto(a, role));
  const roster = role === 'teacher'
    ? req.db.prepare('SELECT u.id, u.name, u.email, e.role FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? ORDER BY e.role, u.name').all(courseId)
    : undefined;
  res.json({ course: { ...(course as object), role }, assignments, roster });
}));

router.post('/courses/:courseId/enrollments', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId, 'teacher');
  const email = str(req.body?.email, 'email', { max: 254 }).toLowerCase();
  const role = req.body?.role ?? 'student';
  if (role !== 'teacher' && role !== 'student') throw badRequest('role must be teacher or student');
  const target = req.db.prepare('SELECT id, role FROM users WHERE email = ?').get(email) as { id: string; role: string } | undefined;
  if (!target) throw notFound('No user with that email');
  if (role === 'teacher' && target.role === 'student') throw badRequest('Student accounts cannot be enrolled as teachers');
  const course = req.db.prepare('SELECT owner_id FROM courses WHERE id = ?').get(courseId) as { owner_id: string };
  const existing = req.db.prepare('SELECT role FROM enrollments WHERE course_id = ? AND user_id = ?').get(courseId, target.id) as { role: string } | undefined;
  if (existing && existing.role !== role) {
    if (target.id === course.owner_id) throw forbidden("The course owner's role cannot be changed");
    if (existing.role === 'teacher' && user.id !== course.owner_id && user.role !== 'admin') throw forbidden('Only the course owner can change a teacher\'s role');
  }
  req.db.prepare('INSERT INTO enrollments (course_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(course_id, user_id) DO UPDATE SET role = excluded.role').run(courseId, target.id, role);
  audit(req.db, user.id, 'enroll', 'course', courseId);
  res.status(201).json({ enrollment: { courseId, userId: target.id, role } });
}));

router.get('/courses/:courseId/rubrics', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId);
  const ids = req.db.prepare('SELECT id FROM rubrics WHERE course_id = ? ORDER BY created_at').all(courseId) as { id: string }[];
  res.json({ rubrics: ids.map((r) => loadRubric(req.db, r.id)) });
}));

router.post('/courses/:courseId/rubrics', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId, 'teacher');
  const title = str(req.body?.title, 'title', { max: 200 });
  const criteria = parseCriteria(req.body?.criteria);
  const id = crypto.randomUUID();
  req.db.prepare('INSERT INTO rubrics (id, course_id, title, criteria_json) VALUES (?, ?, ?, ?)').run(id, courseId, title, JSON.stringify(criteria));
  res.status(201).json({ rubric: loadRubric(req.db, id) });
}));

function readAssignmentInput(body: Record<string, unknown>, db: DB, courseId: string, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || body.title !== undefined) out.title = str(body.title, 'title', { max: 200 });
  if (body.description !== undefined) out.description = str(body.description, 'description', { max: 20000, optional: true });
  if (!partial || body.pointsPossible !== undefined) out.points_possible = num(body.pointsPossible ?? 100, 'pointsPossible', { min: 0, max: 100000 });
  if (body.dueAt !== undefined) {
    const due = body.dueAt === null || body.dueAt === '' ? null : str(body.dueAt, 'dueAt');
    if (due && Number.isNaN(Date.parse(due))) throw badRequest('dueAt must be an ISO date');
    out.due_at = due;
  }
  if (body.rubricId !== undefined) {
    const rubricId = body.rubricId ? str(body.rubricId, 'rubricId') : null;
    if (rubricId) {
      const r = db.prepare('SELECT course_id FROM rubrics WHERE id = ?').get(rubricId) as { course_id: string } | undefined;
      if (!r || r.course_id !== courseId) throw badRequest('rubricId does not belong to this course');
    }
    out.rubric_id = rubricId;
  }
  if (body.similarityEnabled !== undefined) out.similarity_enabled = bool(body.similarityEnabled, true) ? 1 : 0;
  if (body.studentsSeeSimilarity !== undefined) out.students_see_similarity = bool(body.studentsSeeSimilarity, false) ? 1 : 0;
  if (body.aiAssessmentEnabled !== undefined) out.ai_assessment_enabled = bool(body.aiAssessmentEnabled, false) ? 1 : 0;
  return out;
}

router.post('/courses/:courseId/assignments', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId, 'teacher');
  const input = readAssignmentInput(req.body ?? {}, req.db, courseId, false);
  const id = crypto.randomUUID();
  const cols = ['id', 'course_id', ...Object.keys(input)];
  req.db.prepare(`INSERT INTO assignments (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(id, courseId, ...(Object.values(input) as (string | number | null)[]));
  audit(req.db, user.id, 'create', 'assignment', id);
  const row = req.db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as never;
  res.status(201).json({ assignment: assignmentDto(row) });
}));

router.patch('/assignments/:assignmentId', ah((req, res) => {
  const user = requireUser(req);
  const { assignment, role } = loadAssignment(req.db, user, param(req, 'assignmentId'));
  if (role !== 'teacher') throw forbidden();
  const input = readAssignmentInput(req.body ?? {}, req.db, assignment.course_id, true);
  const keys = Object.keys(input);
  if (keys.length) {
    req.db.prepare(`UPDATE assignments SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...(Object.values(input) as (string | number | null)[]), assignment.id);
  }
  const row = req.db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignment.id) as never;
  res.json({ assignment: assignmentDto(row) });
}));

router.get('/assignments/:assignmentId', ah((req, res) => {
  const user = requireUser(req);
  const { assignment, role } = loadAssignment(req.db, user, param(req, 'assignmentId'));
  const rubric = loadRubric(req.db, assignment.rubric_id);
  const base = `
    SELECT s.id, s.student_id AS studentId, u.name AS studentName, s.attempt, s.status, s.submitted_at AS submittedAt,
           d.original_name AS fileName, d.format, g.status AS gradeStatus, g.score,
           (SELECT overall_percent FROM similarity_reports r WHERE r.submission_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS similarityPercent
    FROM submissions s JOIN users u ON u.id = s.student_id JOIN documents d ON d.id = s.document_id
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE s.assignment_id = ?`;
  let submissions: Record<string, unknown>[];
  if (role === 'teacher') {
    submissions = req.db.prepare(`${base} AND s.attempt = (SELECT MAX(attempt) FROM submissions s2 WHERE s2.assignment_id = s.assignment_id AND s2.student_id = s.student_id) ORDER BY u.name`).all(assignment.id) as never;
  } else {
    submissions = (req.db.prepare(`${base} AND s.student_id = ? ORDER BY s.attempt DESC`).all(assignment.id, user.id) as Record<string, unknown>[]).map((s) => ({
      ...s,
      score: s.gradeStatus === 'published' ? s.score : null,
      gradeStatus: s.gradeStatus === 'published' ? 'published' : null,
      similarityPercent: assignment.students_see_similarity ? s.similarityPercent : null,
    }));
  }
  res.json({ assignment: assignmentDto(assignment, role), role, rubric, submissions });
}));

router.get('/courses/:courseId/sources', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId, 'teacher');
  const sources = req.db.prepare('SELECT id, title, url, length(text) AS length, created_at AS createdAt FROM reference_sources WHERE course_id = ? ORDER BY created_at').all(courseId);
  res.json({ sources });
}));

router.post('/courses/:courseId/sources', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId, 'teacher');
  const title = str(req.body?.title, 'title', { max: 300 });
  const url = str(req.body?.url, 'url', { max: 2000, optional: true }) || null;
  if (url && !/^https?:\/\//i.test(url)) throw badRequest('url must start with http:// or https://');
  const text = str(req.body?.text, 'text', { min: 20, max: 2_000_000 });
  const id = crypto.randomUUID();
  req.db.prepare('INSERT INTO reference_sources (id, course_id, title, url, text) VALUES (?, ?, ?, ?, ?)').run(id, courseId, title, url, text);
  res.status(201).json({ source: { id, title, url } });
}));

router.delete('/courses/:courseId/sources/:sourceId', ah((req, res) => {
  const user = requireUser(req);
  const courseId = param(req, 'courseId');
  requireCourseRole(req.db, user, courseId, 'teacher');
  const r = req.db.prepare('DELETE FROM reference_sources WHERE id = ? AND course_id = ?').run(param(req, 'sourceId'), courseId);
  if (!r.changes) throw new HttpError(404, 'Source not found');
  res.json({ ok: true });
}));

export default router;
