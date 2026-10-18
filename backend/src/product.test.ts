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
  assert.equal(visible.body.submission.aiAssessment.consequentialUseEnabled, false);
  assert.equal(visible.body.submission.aiAssessment.humanReviewRequired, true);

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
  assert.equal(submission.body.submission.aiAssessment.consequentialUseEnabled, false);
});
