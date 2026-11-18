import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createApp } from './app';
import { seedDemo, DEMO_ACCOUNTS } from './seed';
import { processNextJob } from './worker';
import { refreshStaleAnalyses } from './services/aiAssessment';
import { hashPassword } from './services/auth';
import prisma from './db/prisma';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

let server: Server;
let base = '';

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { token: string };
  return body.token;
}

async function json(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

test.before(async () => {
  await seedDemo();
  await refreshStaleAnalyses();
  const app = createApp();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test('health and format matrix are public', async () => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  const formats = await fetch(`${base}/api/formats`);
  const body = await formats.json() as { formats: Array<{ format: string; nativeEditing: boolean; tested: boolean }> };
  assert.equal(body.formats.every((format) => format.nativeEditing === false), true);
  assert.equal(body.formats.some((format) => format.format === 'TXT' && format.tested), true);
  assert.equal(body.formats.some((format) => format.format === 'DOC' && format.tested === false), true);
});

test('students cannot see drafts or other students, and published feedback is visible', async () => {
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const grace = await login(DEMO_ACCOUNTS.grace.email, DEMO_ACCOUNTS.grace.password);
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const courses = await json('/api/courses', teacher);
  const courseId = courses.body.courses[0].id as string;
  const course = await json(`/api/courses/${courseId}`, teacher);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Opening paragraph close reading');
  const submissionId = assignment.submissions[0].id as string;

  await json(`/api/submissions/${submissionId}/grade`, teacher, {
    method: 'POST',
    body: JSON.stringify({ score: 16, maxScore: 20, feedback: 'Still a draft.', publish: false }),
  });
  const secret = `Unpublished margin note ${Date.now()}`;
  const draftAnnotation = await json(`/api/submissions/${submissionId}/annotations`, teacher, {
    method: 'POST',
    body: JSON.stringify({ type: 'POINT', content: secret, anchor: { kind: 'text', start: 0, end: 12 } }),
  });
  assert.equal(draftAnnotation.status, 201);
  const hidden = await json(`/api/submissions/${submissionId}`, grace);
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.submission.grade, null);
  assert.equal(hidden.body.submission.annotations.some((item: { content: string }) => item.content === secret), false);

  const forbidden = await json(`/api/submissions/${submissionId}`, alan);
  assert.equal(forbidden.status, 403);

  const published = await json(`/api/submissions/${submissionId}/grade`, teacher, {
    method: 'POST',
    body: JSON.stringify({ score: 16, maxScore: 20, feedback: 'Published for the demo.', publish: true, rubricScores: { evidence: 10, interpretation: 6 } }),
  });
  assert.equal(published.status, 200);
  const visible = await json(`/api/submissions/${submissionId}`, grace);
  assert.equal(visible.body.submission.grade.score, 16);
  assert.equal(visible.body.submission.grade.isDraft, false);
  assert.equal(visible.body.submission.annotations.some((item: { content: string }) => item.content === secret), true);
  assert.ok(visible.body.submission.similarityReport.overallSimilarity > 15);
  assert.equal(visible.body.submission.aiAssessment, null);

  const reset = await fetch(`${base}/api/test/reset`, { method: 'POST' });
  assert.equal(reset.status, 404);
});

test('pdf uploads extract text without claiming native editing', async () => {
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const courses = await json('/api/courses', alan);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, alan);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Optional source notes');
  const pdf = Buffer.from(`%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 20 100 Td (Hello from the lab) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
trailer<< /Root 1 0 R >>
%%EOF`);
  const form = new FormData();
  form.set('file', new Blob([pdf], { type: 'application/pdf' }), 'lab.pdf');
  const upload = await fetch(`${base}/api/assignments/${assignment.id}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alan}` },
    body: form,
  });
  assert.equal(upload.status, 201);
  const created = await upload.json() as { submissionId: string };
  for (let i = 0; i < 5; i += 1) {
    if (!(await processNextJob())) break;
  }
  const submission = await json(`/api/submissions/${created.submissionId}`, alan);
  assert.equal(submission.body.submission.document.processingStatus, 'COMPLETED');
  assert.match(submission.body.submission.document.textContent, /Hello from the lab/);
  assert.match(submission.body.submission.document.metadata.note, /extracted text/);
});

test('docx uploads extract paragraph text', async () => {
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const courses = await json('/api/courses', alan);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, alan);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Optional source notes');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-docx-api-'));
  await fs.mkdir(path.join(dir, 'word'));
  await fs.writeFile(
    path.join(dir, 'word', 'document.xml'),
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Docx lab sentence about rivers.</w:t></w:r></w:p></w:body></w:document>',
  );
  const file = path.join(dir, 'rivers.docx');
  await promisify(execFile)('zip', ['-q', '-r', file, 'word'], { cwd: dir });
  const bytes = await fs.readFile(file);
  const form = new FormData();
  form.set('file', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'rivers.docx');
  const upload = await fetch(`${base}/api/assignments/${assignment.id}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alan}` },
    body: form,
  });
  assert.equal(upload.status, 201);
  const created = await upload.json() as { submissionId: string };
  for (let i = 0; i < 5; i += 1) {
    if (!(await processNextJob())) break;
  }
  const submission = await json(`/api/submissions/${created.submissionId}`, alan);
  assert.equal(submission.body.submission.document.processingStatus, 'COMPLETED');
  assert.match(submission.body.submission.document.textContent, /rivers/);
  assert.match(submission.body.submission.document.metadata.note, /not the original Word layout/);
});

test('a student upload is processed in the background', async () => {
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const courses = await json('/api/courses', alan);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, alan);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Optional source notes');
  const form = new FormData();
  form.set('file', new Blob(['Original lab notes that do not quote Austen or Lincoln at all. The observation is only about my own margin marks and a late library visit.'], { type: 'text/plain' }), 'notes.txt');
  const upload = await fetch(`${base}/api/assignments/${assignment.id}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alan}` },
    body: form,
  });
  assert.equal(upload.status, 201);
  const created = await upload.json() as { submissionId: string };
  for (let i = 0; i < 5; i += 1) {
    const worked = await processNextJob();
    if (!worked) break;
  }
  const submission = await json(`/api/submissions/${created.submissionId}`, alan);
  assert.equal(submission.body.submission.document.processingStatus, 'COMPLETED');
  assert.match(submission.body.submission.document.textContent, /margin marks/);
  assert.equal(submission.body.submission.aiAssessment, null);

  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const teacherView = await json(`/api/submissions/${created.submissionId}`, teacher);
  assert.equal(teacherView.body.submission.aiAssessment.consequentialUseEnabled, false);
  assert.equal(teacherView.body.submission.aiAssessment.outcome, 'INSUFFICIENT_TEXT');
});

test('similarity passages are character spans of the submission, and bibliography is excluded', async () => {
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const courses = await json('/api/courses', teacher);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, teacher);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Opening paragraph close reading');
  const submissionId = assignment.submissions[0].id as string;
  const defaults = await json(`/api/submissions/${submissionId}/similarity/recalculate`, teacher, { method: 'POST', body: '{}' });
  assert.equal(defaults.status, 200);
  const view = await json(`/api/submissions/${submissionId}`, teacher);
  const { document, similarityReport } = view.body.submission;
  const austen = similarityReport.sources.find((source: { sourceName: string }) => source.sourceName.startsWith('Pride and Prejudice'));
  assert.ok(austen, 'the seeded Austen opening is attributed to the reference source');
  assert.equal(austen.sourceType, 'PUBLICATION');
  for (const passage of austen.passages) {
    assert.equal(document.textContent.slice(passage.startPosition, passage.endPosition), passage.submissionText);
    assert.ok(passage.sourceText.length > 0);
  }
  assert.equal(similarityReport.excludedMatches.some((item: { reason: string; text: string }) => item.reason === 'BIBLIOGRAPHY' && /Austen, Jane/.test(item.text)), true);

  const recalculated = await json(`/api/submissions/${submissionId}/similarity/recalculate`, teacher, {
    method: 'POST',
    body: JSON.stringify({ excludeBibliography: false, excludeSmallMatches: true, smallMatchThreshold: 8 }),
  });
  assert.equal(recalculated.status, 200);
  assert.equal(recalculated.body.report.excludeBibliography, false);
  assert.ok(recalculated.body.report.overallSimilarity >= similarityReport.overallSimilarity);
  const restored = await json(`/api/submissions/${submissionId}/similarity/recalculate`, teacher, { method: 'POST', body: '{}' });
  assert.equal(restored.body.report.excludeBibliography, true);
});

test('AI-writing review requires the course teacher, a known decision, and a note', async () => {
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const grace = await login(DEMO_ACCOUNTS.grace.email, DEMO_ACCOUNTS.grace.password);
  const courses = await json('/api/courses', teacher);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, teacher);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Opening paragraph close reading');
  const submissionId = assignment.submissions[0].id as string;
  const path = `/api/submissions/${submissionId}/ai-assessment/review`;

  const before = await json(`/api/submissions/${submissionId}`, teacher);
  const assessment = before.body.submission.aiAssessment;
  assert.equal(assessment.humanReviewRequired, true);
  assert.equal(assessment.evaluation.validated, false);
  assert.equal(assessment.evaluation.stage, 'EXPERIMENTAL');
  assert.match(assessment.limitations, /Not evidence of misconduct/);
  assert.match(assessment.features.modelVersion, /experimental/);

  const student = await json(path, grace, { method: 'POST', body: JSON.stringify({ decision: 'NO_CONCERN', note: 'I reviewed my own work.' }) });
  assert.equal(student.status, 403);
  const badDecision = await json(path, teacher, { method: 'POST', body: JSON.stringify({ decision: 'AI_WROTE_IT', note: 'Long enough note here.' }) });
  assert.equal(badDecision.status, 400);
  const noNote = await json(path, teacher, { method: 'POST', body: JSON.stringify({ decision: 'NO_CONCERN', note: ' ' }) });
  assert.equal(noNote.status, 400);
  const ok = await json(path, teacher, {
    method: 'POST',
    body: JSON.stringify({ decision: 'SIGNAL_NOT_RELIABLE', note: 'Essay is mostly a quoted opening line; the signal is not meaningful.' }),
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.aiAssessment.reviewDecision, 'SIGNAL_NOT_RELIABLE');
  assert.equal(ok.body.aiAssessment.reviewedBy.name, DEMO_ACCOUNTS.teacher.name);

  const studentView = await json(`/api/submissions/${submissionId}`, grace);
  assert.equal(studentView.body.submission.aiAssessment, null);
});

test('students see peer matches without the classmate name or text', async () => {
  const grace = await login(DEMO_ACCOUNTS.grace.email, DEMO_ACCOUNTS.grace.password);
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const courses = await json('/api/courses', grace);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, grace);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Optional source notes');
  const form = new FormData();
  form.set('file', new Blob(['My summary borrows a line: Original lab notes that do not quote Austen or Lincoln at all. The observation is only about my own margin marks and a late library visit.'], { type: 'text/plain' }), 'grace-notes.txt');
  const upload = await fetch(`${base}/api/assignments/${assignment.id}/submissions`, { method: 'POST', headers: { Authorization: `Bearer ${grace}` }, body: form });
  assert.equal(upload.status, 201);
  const { submissionId } = await upload.json() as { submissionId: string };
  for (let i = 0; i < 5; i += 1) {
    if (!(await processNextJob())) break;
  }

  const teacherView = await json(`/api/submissions/${submissionId}`, teacher);
  const teacherPeer = teacherView.body.submission.similarityReport.sources.find((source: { sourceType: string }) => source.sourceType === 'STUDENT_PAPER');
  assert.ok(teacherPeer, 'an earlier upload in the assignment is matched');
  assert.match(teacherPeer.sourceName, /^Another submission by (Alan Turing|Grace Hopper)$/);
  assert.ok(teacherPeer.passages[0].sourceText.length > 0);

  const studentView = await json(`/api/submissions/${submissionId}`, grace);
  const sources = studentView.body.submission.similarityReport.sources as Array<{ sourceType: string; sourceName: string; passages: Array<{ sourceText: string }> }>;
  const studentPeers = sources.filter((source) => source.sourceType === 'STUDENT_PAPER');
  assert.ok(studentPeers.length > 0);
  for (const peer of studentPeers) {
    assert.equal(peer.sourceName, 'Another submission in this assignment');
    assert.equal(peer.passages.every((passage) => passage.sourceText === ''), true);
  }
  assert.equal(JSON.stringify(studentView.body.submission.similarityReport).includes('Another submission by'), false);
  assert.equal(JSON.stringify(studentView.body).includes('Alan Turing'), false);
});

test('teachers outside the course and admins cannot review, and superseded reviews stay in the audit log', async () => {
  const institution = await prisma.institution.findUniqueOrThrow({ where: { domain: 'demo.lab' } });
  const password = 'OtherTeacher!2026';
  for (const [email, role] of [['outsider@demo.lab', 'TEACHER'], ['admin@demo.lab', 'ADMIN']] as const) {
    await prisma.user.upsert({
      where: { email },
      update: { role, passwordHash: hashPassword(password) },
      create: { email, name: email, role, passwordHash: hashPassword(password), institutionId: institution.id },
    });
  }
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const outsider = await login('outsider@demo.lab', password);
  const admin = await login('admin@demo.lab', password);
  const courses = await json('/api/courses', teacher);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, teacher);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Opening paragraph close reading');
  const submissionId = assignment.submissions[0].id as string;
  const path = `/api/submissions/${submissionId}/ai-assessment/review`;
  const body = JSON.stringify({ decision: 'NO_CONCERN', note: 'Not my course, should be refused.' });
  assert.equal((await json(path, outsider, { method: 'POST', body })).status, 403);
  assert.equal((await json(path, admin, { method: 'POST', body })).status, 403);
  assert.equal((await json(`/api/submissions/${submissionId}`, outsider)).status, 403);

  const note = `Reviewed before a model change ${Date.now()}`;
  assert.equal((await json(path, teacher, { method: 'POST', body: JSON.stringify({ decision: 'DISCUSS_WITH_STUDENT', note }) })).status, 200);
  await prisma.aiAssessment.update({ where: { submissionId }, data: { features: { modelVersion: 'older-model' } } });
  assert.equal(await refreshStaleAnalyses(), 1);
  const after = await json(`/api/submissions/${submissionId}`, teacher);
  assert.equal(after.body.submission.aiAssessment.reviewDecision, null);
  assert.match(after.body.submission.aiAssessment.features.modelVersion, /experimental/);
  const history = await prisma.auditLog.findMany({ where: { entityId: submissionId, action: 'ai_review_superseded' } });
  assert.equal(history.some((row) => (row.changes as { note?: string } | null)?.note === note), true);
});
