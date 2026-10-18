import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, resetDatabase } from '../src/db/database';
import { resetRateLimits } from '../src/auth/auth';
import { makeDocx, makePdf } from './fixtures';
import { extractContent } from '../src/documents/processing';

const binaryParser = (res: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysl8te-test-'));
const db = openDatabase(':memory:');
const app = createApp({ db, uploadDir, maxFileSize: 2 * 1024 * 1024, allowTestReset: true });

afterAll(() => fs.rmSync(uploadDir, { recursive: true, force: true }));

beforeEach(() => {
  resetDatabase(db);
  resetRateLimits();
});

async function register(name: string, role: 'teacher' | 'student') {
  const email = `${name.toLowerCase()}@school.test`;
  const res = await request(app).post('/api/auth/register').send({ email, name, password: 'correct horse battery', role });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, id: res.body.user.id as string, email };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const ESSAY = 'Wetlands act as natural sponges in a landscape. During heavy storms they absorb excess runoff and release it slowly, which reduces flooding in nearby towns. '.repeat(3);

async function setupCourse() {
  const teacher = await register('Teacher', 'teacher');
  const alice = await register('Alice', 'student');
  const bob = await register('Bob', 'student');
  const outsider = await register('Mallory', 'student');
  const course = await request(app).post('/api/courses').set(auth(teacher.token)).send({ name: 'Biology', code: 'BIO-1' });
  const courseId = course.body.course.id as string;
  for (const s of [alice, bob]) {
    const r = await request(app).post(`/api/courses/${courseId}/enrollments`).set(auth(teacher.token)).send({ email: s.email });
    expect(r.status).toBe(201);
  }
  const rubric = await request(app).post(`/api/courses/${courseId}/rubrics`).set(auth(teacher.token)).send({
    title: 'Essay', criteria: [
      { description: 'Argument', points: 10, ratings: [{ label: 'Full', points: 10 }, { label: 'Half', points: 5 }] },
      { description: 'Evidence', points: 10, ratings: [{ label: 'Full', points: 10 }, { label: 'None', points: 0 }] },
    ],
  });
  expect(rubric.status).toBe(201);
  const assignment = await request(app).post(`/api/courses/${courseId}/assignments`).set(auth(teacher.token))
    .send({ title: 'Essay 1', pointsPossible: 50, rubricId: rubric.body.rubric.id, similarityEnabled: true, aiAssessmentEnabled: true });
  expect(assignment.status).toBe(201);
  return { teacher, alice, bob, outsider, courseId, assignmentId: assignment.body.assignment.id as string, rubric: rubric.body.rubric };
}

async function submit(token: string, assignmentId: string, buf: Buffer, name: string) {
  return request(app).post(`/api/assignments/${assignmentId}/submissions`).set(auth(token)).attach('file', buf, name);
}

describe('authentication', () => {
  it('registers, logs in with cookie session, and logs out', async () => {
    await register('Tess', 'teacher');
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: 'tess@school.test', password: 'correct horse battery' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('tess@school.test');
    const noCsrf = await agent.post('/api/courses').send({ name: 'X', code: 'X' });
    expect(noCsrf.status).toBe(403);
    const withCsrf = await agent.post('/api/courses').set('X-Requested-With', 'mysl8te').send({ name: 'X', code: 'X' });
    expect(withCsrf.status).toBe(201);
    await agent.post('/api/auth/logout').set('X-Requested-With', 'mysl8te');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects bad credentials, duplicate emails, weak passwords and admin self-registration', async () => {
    await register('Sam', 'student');
    expect((await request(app).post('/api/auth/login').send({ email: 'sam@school.test', password: 'wrong password' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'nobody@school.test', password: 'whatever1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/register').send({ email: 'sam@school.test', name: 'S', password: 'longenough' })).status).toBe(409);
    expect((await request(app).post('/api/auth/register').send({ email: 'x@school.test', name: 'S', password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ email: 'y@school.test', name: 'S', password: 'longenough', role: 'admin' })).status).toBe(400);
  });

  it('does not trim passwords', async () => {
    await request(app).post('/api/auth/register').send({ email: 'sp@school.test', name: 'Sp', password: '  spaced pass  ' });
    expect((await request(app).post('/api/auth/login').send({ email: 'sp@school.test', password: 'spaced pass' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'sp@school.test', password: '  spaced pass  ' })).status).toBe(200);
  });

  it('rate-limits repeated failed logins', async () => {
    await register('Rae', 'student');
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await request(app).post('/api/auth/login').send({ email: 'rae@school.test', password: 'bad-password' })).status;
    expect(last).toBe(429);
  });

  it('stores only password and session hashes', async () => {
    const t = await register('Hash', 'student');
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(t.id) as { password_hash: string };
    expect(user.password_hash).toMatch(/^scrypt\$/);
    const sessions = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    expect(sessions.every((s) => s.token_hash !== t.token)).toBe(true);
  });
});

describe('courses and permissions', () => {
  it('prevents students from creating courses or assignments and hides foreign courses', async () => {
    const { alice, outsider, courseId } = await setupCourse();
    expect((await request(app).post('/api/courses').set(auth(alice.token)).send({ name: 'A', code: 'B' })).status).toBe(403);
    expect((await request(app).post(`/api/courses/${courseId}/assignments`).set(auth(alice.token)).send({ title: 'x' })).status).toBe(403);
    expect((await request(app).get(`/api/courses/${courseId}`).set(auth(outsider.token))).status).toBe(404);
    const aliceView = await request(app).get(`/api/courses/${courseId}`).set(auth(alice.token));
    expect(aliceView.body.roster).toBeUndefined();
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/courses')).status).toBe(401);
  });
});

describe('submissions, annotations and grading', () => {
  it('runs the full teacher/student workflow with draft and published feedback', async () => {
    const { teacher, alice, bob, outsider, assignmentId, rubric } = await setupCourse();
    const pdf = makePdf([['Wetlands act as natural sponges in a landscape.', 'They reduce flooding.'], ['Page two conclusion.']]);
    const sub = await submit(alice.token, assignmentId, pdf, 'essay.pdf');
    expect(sub.status).toBe(201);
    expect(sub.body.document.format).toBe('PDF');
    expect(sub.body.document.pageCount).toBe(2);
    expect(sub.body.document.text).toContain('natural sponges');
    const id = sub.body.submission.id as string;

    expect((await request(app).get(`/api/submissions/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).get(`/api/submissions/${id}/file`).set(auth(outsider.token))).status).toBe(404);
    const file = await request(app).get(`/api/submissions/${id}/file`).set(auth(teacher.token));
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-security-policy']).toContain('sandbox');

    const ann = await request(app).post(`/api/submissions/${id}/annotations`).set(auth(teacher.token))
      .send({ type: 'highlight', page: 1, coords: { rects: [{ x: 0.1, y: 0.1, w: 0.5, h: 0.03 }] }, content: 'Strong opening', color: '#ffcc00' });
    expect(ann.status).toBe(201);
    expect(ann.body.annotation.published).toBe(false);
    for (const body of [
      { type: 'point', page: 2, coords: { x: 0.5, y: 0.5 }, content: 'Expand this' },
      { type: 'area', page: 1, coords: { x: 0.2, y: 0.4, w: 0.3, h: 0.2 } },
      { type: 'strikeout', page: 1, coords: { rects: [{ x: 0.1, y: 0.3, w: 0.2, h: 0.02 }] } },
      { type: 'freedraw', page: 1, coords: { paths: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.25 }, { x: 0.3, y: 0.2 }]] } },
      { type: 'freetext', page: 2, coords: { x: 0.6, y: 0.1, w: 0.3, h: 0.05 }, content: 'Nice!' },
    ]) {
      expect((await request(app).post(`/api/submissions/${id}/annotations`).set(auth(teacher.token)).send(body)).status).toBe(201);
    }
    const invalid = [
      { type: 'point', page: 3, coords: { x: 0.5, y: 0.5 } },
      { type: 'point', page: 1, coords: { x: 1.5, y: 0.5 } },
      { type: 'area', page: 1, coords: { x: 0.9, y: 0.1, w: 0.3, h: 0.1 } },
      { type: 'freetext', page: 1, coords: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } },
      { type: 'bogus', page: 1, coords: {} },
    ];
    for (const body of invalid) {
      expect((await request(app).post(`/api/submissions/${id}/annotations`).set(auth(teacher.token)).send(body)).status).toBe(400);
    }
    expect((await request(app).post(`/api/submissions/${id}/annotations`).set(auth(alice.token)).send({ type: 'point', page: 1, coords: { x: 0.1, y: 0.1 } })).status).toBe(403);

    const edited = await request(app).patch(`/api/annotations/${ann.body.annotation.id}`).set(auth(teacher.token)).send({ content: 'Strong opening sentence' });
    expect(edited.body.annotation.content).toBe('Strong opening sentence');

    await request(app).post(`/api/submissions/${id}/comments`).set(auth(teacher.token)).send({ body: 'Good work overall' });
    const [arg, evid] = rubric.criteria;
    const grade = await request(app).put(`/api/submissions/${id}/grade`).set(auth(teacher.token))
      .send({ rubricScores: { [arg.id]: { ratingId: arg.ratings[0].id }, [evid.id]: { points: 5, comment: 'Cite more' } }, feedback: 'See comments' });
    expect(grade.status).toBe(200);
    expect(grade.body.grade.score).toBe(37.5);
    expect(grade.body.grade.status).toBe('draft');

    let studentView = await request(app).get(`/api/submissions/${id}`).set(auth(alice.token));
    expect(studentView.body.grade).toBeNull();
    expect(studentView.body.annotations).toHaveLength(0);
    expect(studentView.body.comments).toHaveLength(0);
    expect((await request(app).get(`/api/assignments/${assignmentId}`).set(auth(alice.token))).body.submissions[0].score).toBeNull();

    expect((await request(app).post(`/api/submissions/${id}/grade/publish`).set(auth(alice.token))).status).toBe(403);
    expect((await request(app).post(`/api/submissions/${id}/grade/publish`).set(auth(teacher.token))).status).toBe(200);

    studentView = await request(app).get(`/api/submissions/${id}`).set(auth(alice.token));
    expect(studentView.body.grade.score).toBe(37.5);
    expect(studentView.body.annotations).toHaveLength(6);
    expect(studentView.body.comments).toHaveLength(1);

    const reply = await request(app).post(`/api/annotations/${ann.body.annotation.id}/replies`).set(auth(alice.token)).send({ body: 'Thanks!' });
    expect(reply.status).toBe(201);
    expect(reply.body.annotation.replies[0].body).toBe('Thanks!');
    expect((await request(app).patch(`/api/annotations/${ann.body.annotation.id}`).set(auth(alice.token)).send({ content: 'hacked' })).status).toBe(403);
    expect((await request(app).delete(`/api/annotations/${ann.body.annotation.id}`).set(auth(alice.token))).status).toBe(403);

    const exported = await request(app).get(`/api/submissions/${id}/export`).set(auth(alice.token));
    expect(exported.status).toBe(200);
    expect(exported.text).toContain('Strong opening sentence');
    expect(exported.text).toContain('37.5');
    expect(exported.text).not.toMatch(/<script/i);

    const pdfExport = await request(app).get(`/api/submissions/${id}/export?format=pdf`).set(auth(alice.token)).buffer(true).parse(binaryParser as never);
    expect(pdfExport.status).toBe(200);
    expect(pdfExport.headers['content-type']).toBe('application/pdf');
    const exported2 = await extractContent(pdfExport.body as Buffer, 'PDF');
    expect(exported2.pageCount).toBe(3);
    expect(exported2.text).toContain('natural sponges');
    expect(exported2.text).toContain('Strong opening sentence');
    expect(exported2.text).toContain('37.5 / 50 (published)');

    const teacherList = await request(app).get(`/api/assignments/${assignmentId}`).set(auth(teacher.token));
    expect(teacherList.body.submissions).toHaveLength(1);
    expect(teacherList.body.submissions[0].gradeStatus).toBe('published');
  });

  it('accepts DOCX and text, rejects disguised or oversized files, and numbers attempts', async () => {
    const { alice, teacher, assignmentId } = await setupCourse();
    const docx = await submit(alice.token, assignmentId, makeDocx(['# Essay', ESSAY]), 'essay.docx');
    expect(docx.status).toBe(201);
    expect(docx.body.document.html).toContain('<h1>Essay</h1>');
    const txt = await submit(alice.token, assignmentId, Buffer.from(ESSAY), 'essay.txt');
    expect(txt.body.submission.attempt).toBe(2);
    expect((await submit(alice.token, assignmentId, Buffer.from('MZ\x90\x00binary\x00\x00'), 'essay.pdf')).status).toBe(415);
    expect((await submit(alice.token, assignmentId, Buffer.alloc(3 * 1024 * 1024, 'a'), 'big.txt')).status).toBe(413);
    expect((await submit(alice.token, assignmentId, Buffer.from('%PDF-1.4 broken'), 'broken.pdf')).status).toBe(422);
    expect((await submit(teacher.token, assignmentId, Buffer.from(ESSAY), 'essay.txt')).status).toBe(403);
    const html = await submit(alice.token, assignmentId, Buffer.from('<p onclick="x()">Hello<script>alert(1)</script></p>'), 'page.html');
    expect(html.status).toBe(201);
    expect(html.body.document.html).toBe('<p>Hello</p>');

    const docxPdf = await request(app).get(`/api/submissions/${docx.body.submission.id}/export?format=pdf`).set(auth(alice.token)).buffer(true).parse(binaryParser as never);
    expect(docxPdf.status).toBe(200);
    const parsed = await extractContent(docxPdf.body as Buffer, 'PDF');
    expect(parsed.text).toContain('Wetlands act as natural sponges');
    expect(parsed.text).toContain('No grade has been released.');
  });
});

describe('similarity and AI-writing assessment', () => {
  it('matches copied text against reference sources and other students, with role-appropriate visibility', async () => {
    const { teacher, alice, bob, courseId, assignmentId } = await setupCourse();
    const refText = 'The water cycle describes the continuous movement of water on, above, and below the surface of the Earth, changing state between liquid, vapor, and ice.';
    expect((await request(app).post(`/api/courses/${courseId}/sources`).set(auth(teacher.token)).send({ title: 'Reader', text: refText })).status).toBe(201);
    expect((await request(app).post(`/api/courses/${courseId}/sources`).set(auth(alice.token)).send({ title: 'x', text: refText })).status).toBe(403);
    await submit(alice.token, assignmentId, Buffer.from(ESSAY), 'alice.txt');
    const bobText = `${refText} My own thoughts follow here about something entirely different and personal. ${ESSAY.slice(0, 160)}`;
    const bobSub = await submit(bob.token, assignmentId, Buffer.from(bobText), 'bob.txt');
    const id = bobSub.body.submission.id;

    const report = await request(app).get(`/api/submissions/${id}/similarity`).set(auth(teacher.token));
    expect(report.status).toBe(200);
    expect(report.body.report.overallPercent).toBeGreaterThan(30);
    const types = report.body.report.sources.map((s: { type: string }) => s.type).sort();
    expect(types).toEqual(['REFERENCE', 'STUDENT_PAPER']);
    expect(report.body.report.passages.every((p: { sourceExcerpt: string | null }) => typeof p.sourceExcerpt === 'string')).toBe(true);
    for (const p of report.body.report.passages) expect(bobText.slice(p.start, p.end).length).toBeGreaterThan(0);

    expect((await request(app).get(`/api/submissions/${id}/similarity`).set(auth(bob.token))).status).toBe(403);
    const refSourceId = report.body.report.sources.find((s: { type: string }) => s.type === 'REFERENCE').sourceId;
    const rerun = await request(app).post(`/api/submissions/${id}/similarity`).set(auth(teacher.token)).send({ excludedSourceIds: [refSourceId] });
    expect(rerun.status).toBe(201);
    expect(rerun.body.report.sources.map((s: { type: string }) => s.type)).toEqual(['STUDENT_PAPER']);
    expect(rerun.body.report.overallPercent).toBeLessThan(report.body.report.overallPercent);

    await request(app).patch(`/api/assignments/${assignmentId}`).set(auth(teacher.token)).send({ studentsSeeSimilarity: true });
    const studentReport = await request(app).get(`/api/submissions/${id}/similarity`).set(auth(bob.token));
    expect(studentReport.status).toBe(200);
    for (const p of studentReport.body.report.passages) {
      const src = studentReport.body.report.sources.find((s: { sourceId: string }) => s.sourceId === p.sourceId);
      if (src.type === 'STUDENT_PAPER') expect(p.sourceExcerpt).toBeNull();
    }
  });

  it('keeps AI-writing assessment teacher-only, experimental, and requires a human review note', async () => {
    const { teacher, alice, assignmentId } = await setupCourse();
    const sub = await submit(alice.token, assignmentId, Buffer.from(ESSAY.repeat(4)), 'essay.txt');
    const id = sub.body.submission.id;
    expect((await request(app).get(`/api/submissions/${id}/ai-assessment`).set(auth(alice.token))).status).toBe(404);
    const got = await request(app).get(`/api/submissions/${id}/ai-assessment`).set(auth(teacher.token));
    expect(got.status).toBe(200);
    expect(got.body.assessment.result.releaseGate.validated).toBe(false);
    expect(got.body.assessment.result.safeguards.length).toBeGreaterThan(0);
    expect(JSON.stringify(await request(app).get(`/api/submissions/${id}`).set(auth(alice.token)).then((r) => r.body))).not.toMatch(/ai_?assessment|releaseGate/i);

    expect((await request(app).put(`/api/submissions/${id}/ai-assessment/review`).set(auth(teacher.token)).send({ decision: 'no_concern', note: 'short' })).status).toBe(400);
    const review = await request(app).put(`/api/submissions/${id}/ai-assessment/review`).set(auth(teacher.token))
      .send({ decision: 'no_concern', note: 'Reviewed drafts and discussed with student.' });
    expect(review.status).toBe(200);
    expect(review.body.assessment.review.decision).toBe('no_concern');

    await request(app).patch(`/api/assignments/${assignmentId}`).set(auth(teacher.token)).send({ aiAssessmentEnabled: false });
    expect((await request(app).post(`/api/submissions/${id}/ai-assessment`).set(auth(teacher.token))).status).toBe(403);
  });
});

describe('test reset endpoint', () => {
  it('seeds a demo dataset when enabled and is blocked when disabled', async () => {
    const res = await request(app).post('/api/test/reset?seed=demo');
    expect(res.status).toBe(200);
    expect(res.body.seeded.submissions.bob).toBeTruthy();
    const disabled = createApp({ db, uploadDir, allowTestReset: false });
    expect((await request(disabled).post('/api/test/reset')).status).toBe(403);
  });
});
