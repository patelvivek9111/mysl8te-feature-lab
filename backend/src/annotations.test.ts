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
import { hashPassword } from './services/auth';
import { uploadDir } from './services/extract';
import prisma from './db/prisma';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

let server: Server;
let base = '';
const started = new Date();

const ONE_PAGE_PDF = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 20 100 Td (Hello from the lab) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
trailer<< /Root 1 0 R >>
%%EOF`;
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json() as { token: string }).token;
}

async function json(route: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}${route}`, { ...options, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const post = (route: string, token: string, body: unknown) => json(route, token, { method: 'POST', body: JSON.stringify(body) });

async function gradedSubmissionId(teacher: string): Promise<string> {
  const courses = await json('/api/courses', teacher);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, teacher);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Opening paragraph close reading');
  return assignment.submissions[0].id as string;
}

async function upload(token: string, bytes: Buffer, name: string, type: string): Promise<string> {
  const courses = await json('/api/courses', token);
  const course = await json(`/api/courses/${courses.body.courses[0].id}`, token);
  const assignment = course.body.course.assignments.find((item: { title: string }) => item.title === 'Optional source notes');
  const form = new FormData();
  form.set('file', new Blob([bytes], { type }), name);
  const response = await fetch(`${base}/api/assignments/${assignment.id}/submissions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(response.status, 201);
  const { submissionId } = await response.json() as { submissionId: string };
  for (let i = 0; i < 5; i += 1) {
    if (!(await processNextJob())) break;
  }
  return submissionId;
}

test.before(async () => {
  await seedDemo();
  const app = createApp();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.after(async () => {
  await prisma.notification.deleteMany({ where: { type: 'COMMENT_ADDED', createdAt: { gte: started } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test('teacher and student reply in threads; drafts stay hidden and each side is notified', async () => {
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const grace = await login(DEMO_ACCOUNTS.grace.email, DEMO_ACCOUNTS.grace.password);
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const submissionId = await gradedSubmissionId(teacher);
  const graceId = (await prisma.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.grace.email } })).id;
  const teacherId = (await prisma.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.teacher.email } })).id;
  const created = await post(`/api/submissions/${submissionId}/annotations`, teacher, { type: 'POINT', content: 'Why this word?', anchor: { kind: 'text', start: 0, end: 12 } });
  assert.equal(created.status, 201);
  const annotationId = created.body.annotation.id as string;
  const other = await post(`/api/submissions/${submissionId}/annotations`, teacher, { type: 'HIGHLIGHT', anchor: { kind: 'text', start: 20, end: 30 } });
  try {
    const route = `/api/annotations/${annotationId}/comments`;
    assert.equal((await post(route, grace, { content: 'Cannot see this yet' })).status, 404);
    const draftReply = await post(route, teacher, { content: 'Draft follow-up for later.' });
    assert.equal(draftReply.status, 201);
    assert.equal(draftReply.body.comment.isDraft, true);
    assert.equal(draftReply.body.comment.createdBy.name, DEMO_ACCOUNTS.teacher.name);

    await prisma.annotation.update({ where: { id: annotationId }, data: { isDraft: false, publishedAt: new Date() } });
    const graceBefore = await prisma.notification.count({ where: { userId: graceId, type: 'COMMENT_ADDED' } });
    const teacherReply = await post(route, teacher, { content: 'Look at the second clause.' });
    assert.equal(teacherReply.body.comment.isDraft, false);
    assert.equal(await prisma.notification.count({ where: { userId: graceId, type: 'COMMENT_ADDED' } }), graceBefore + 1);

    const studentView = await json(`/api/submissions/${submissionId}`, grace);
    const seen = studentView.body.submission.annotations.find((item: { id: string }) => item.id === annotationId);
    assert.deepEqual(seen.comments.map((comment: { content: string }) => comment.content), ['Look at the second clause.']);
    assert.equal(seen.comments[0].createdBy.name, DEMO_ACCOUNTS.teacher.name);

    assert.equal((await post(route, grace, { content: 'Replying to a hidden draft', parentId: draftReply.body.comment.id })).status, 400);
    assert.equal((await post(route, grace, { content: '   ' })).status, 400);
    assert.equal((await post(route, grace, { content: 'x'.repeat(4001) })).status, 400);
    assert.equal((await post(route, alan, { content: 'Not my paper' })).status, 404);
    assert.equal((await post(`/api/annotations/${other.body.annotation.id}/comments`, teacher, { content: 'Wrong thread', parentId: teacherReply.body.comment.id })).status, 400);

    const teacherBefore = await prisma.notification.count({ where: { userId: teacherId, type: 'COMMENT_ADDED' } });
    const studentReply = await post(route, grace, { content: 'It makes the claim sound like gossip.', parentId: teacherReply.body.comment.id });
    assert.equal(studentReply.status, 201);
    assert.equal(studentReply.body.comment.isDraft, false);
    assert.equal(studentReply.body.comment.parentId, teacherReply.body.comment.id);
    assert.equal(await prisma.notification.count({ where: { userId: teacherId, type: 'COMMENT_ADDED' } }), teacherBefore + 1);
    const nested = await post(route, teacher, { content: 'Exactly, and that is the irony.', parentId: studentReply.body.comment.id });
    assert.equal(nested.status, 201);

    const teacherView = await json(`/api/submissions/${submissionId}`, teacher);
    const thread = teacherView.body.submission.annotations.find((item: { id: string }) => item.id === annotationId).comments;
    assert.equal(thread.length, 4);

    assert.equal((await json(`/api/comments/${teacherReply.body.comment.id}`, grace, { method: 'DELETE' })).status, 404);
    assert.equal((await json(`/api/comments/${studentReply.body.comment.id}`, grace, { method: 'DELETE' })).status, 409);
    assert.equal((await json(`/api/comments/${studentReply.body.comment.id}`, alan, { method: 'DELETE' })).status, 404);
    const removed = await json(`/api/comments/${teacherReply.body.comment.id}`, teacher, { method: 'DELETE' });
    assert.deepEqual(removed.body, { deleted: 3 });
    const remaining = await prisma.comment.findMany({ where: { annotationId } });
    assert.deepEqual(remaining.map((comment) => comment.id), [draftReply.body.comment.id]);
    const deletion = await prisma.auditLog.findFirst({ where: { action: 'delete_comment', entityId: teacherReply.body.comment.id } });
    assert.equal((deletion?.changes as { removed?: number } | null)?.removed, 3);

    const own = await post(route, grace, { content: 'Second thought, never mind.' });
    assert.deepEqual((await json(`/api/comments/${own.body.comment.id}`, grace, { method: 'DELETE' })).body, { deleted: 1 });

    const kept = await post(route, grace, { content: 'Keep this in the record.' });
    assert.equal(kept.status, 201);
    const deleted = await json(`/api/annotations/${annotationId}`, teacher, { method: 'DELETE' });
    assert.deepEqual(deleted.body, { deleted: true, removedComments: 2 });
    const record = await prisma.auditLog.findFirst({ where: { action: 'delete_annotation', entityId: annotationId } });
    const removedComments = (record?.changes as { removedComments?: Array<{ content: string; createdById: string }> } | null)?.removedComments ?? [];
    assert.equal(removedComments.some((row) => row.content === 'Keep this in the record.' && row.createdById === graceId), true);
    assert.equal((await post(route, teacher, { content: 'Too late' })).status, 404);
  } finally {
    await json(`/api/annotations/${annotationId}`, teacher, { method: 'DELETE' });
    await json(`/api/annotations/${other.body.annotation.id}`, teacher, { method: 'DELETE' });
  }
});

test('outside teachers and admins cannot reply, and the export indents nested replies', async () => {
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
  const submissionId = await gradedSubmissionId(teacher);
  const created = await post(`/api/submissions/${submissionId}/annotations`, teacher, { type: 'STRIKEOUT', content: 'Cut this phrase', anchor: { kind: 'text', start: 0, end: 9 } });
  assert.equal(created.status, 201);
  const route = `/api/annotations/${created.body.annotation.id}/comments`;
  try {
    for (const email of ['outsider@demo.lab', 'admin@demo.lab']) {
      assert.equal((await post(route, await login(email, password), { content: 'Not allowed here' })).status, 404);
    }
    const first = await post(route, teacher, { content: 'Top level reply' });
    await post(route, teacher, { content: 'Nested reply', parentId: first.body.comment.id });
    const response = await fetch(`${base}/api/submissions/${submissionId}/export`, { headers: { Authorization: `Bearer ${teacher}` } });
    assert.equal(response.status, 200);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'thread-export-'));
    try {
      await fs.writeFile(path.join(dir, 'feedback.pdf'), Buffer.from(await response.arrayBuffer()));
      const text = (await promisify(execFile)('pdftotext', ['-layout', path.join(dir, 'feedback.pdf'), '-'])).stdout;
      assert.match(text, /Strikethrough - Ada Lovelace \(draft\)/);
      const top = text.split('\n').find((line) => line.includes('Top level reply'))!;
      const nested = text.split('\n').find((line) => line.includes('Nested reply'))!;
      assert.ok(nested.search(/\S/) > top.search(/\S/), `nested reply should be indented:\n${top}\n${nested}`);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  } finally {
    await json(`/api/annotations/${created.body.annotation.id}`, teacher, { method: 'DELETE' });
  }
});

test('notifications can be marked read one at a time or all at once, only for their owner', async () => {
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const grace = await login(DEMO_ACCOUNTS.grace.email, DEMO_ACCOUNTS.grace.password);
  const alanId = (await prisma.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.alan.email } })).id;
  const graceId = (await prisma.user.findUniqueOrThrow({ where: { email: DEMO_ACCOUNTS.grace.email } })).id;
  const previouslyUnread = (await prisma.notification.findMany({ where: { userId: alanId, read: false }, select: { id: true } })).map((row) => row.id);
  const make = (userId: string, title: string) => prisma.notification.create({ data: { userId, type: 'COMMENT_ADDED', title, message: 'Read-state test' } });
  const first = await make(alanId, 'First');
  const second = await make(alanId, 'Second');
  const others = await make(graceId, 'Not Alan');
  try {
    assert.deepEqual((await post(`/api/notifications/${others.id}/read`, alan, {})).body, { updated: 0 });
    assert.deepEqual((await post(`/api/notifications/${first.id}/read`, alan, {})).body, { updated: 1 });
    const all = await post('/api/notifications/read-all', alan, {});
    assert.equal(all.body.updated, previouslyUnread.length + 1);
    const listed = await json('/api/notifications', alan);
    assert.equal(listed.body.notifications.some((item: { read: boolean }) => !item.read), false);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: others.id } })).read, false);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: second.id } })).readAt instanceof Date, true);
    assert.equal((await post(`/api/notifications/${second.id}/read`, grace, {})).body.updated, 0);
  } finally {
    await prisma.notification.deleteMany({ where: { id: { in: [first.id, second.id, others.id] } } });
    await prisma.notification.updateMany({ where: { id: { in: previouslyUnread } }, data: { read: false, readAt: null } });
  }
});

test('annotation input is validated by type', async () => {
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const submissionId = await gradedSubmissionId(teacher);
  const route = `/api/submissions/${submissionId}/annotations`;
  for (const invalid of [
    { type: 'HIGHLIGHT', color: 'red' },
    { type: 'POINT', content: 'x'.repeat(4001) },
    { type: 'POINT', content: 7 },
    { type: 'HIGHLIGHT', strokeData: '[[{"x":1,"y":1}]]' },
    { type: 'AREA', page: 1, x: 50, y: 10, width: 60, height: 10 },
    { type: 'AREA', page: 1, x: 5, y: 10, width: 0, height: 10 },
    { type: 'FREE_DRAW', page: 1, strokeData: [[{ x: 1, y: 1 }]] },
  ]) {
    assert.equal((await post(route, teacher, invalid)).status, 400, JSON.stringify(invalid));
  }
});

test('PDF and image pages render for drawing, with access checks and stroke validation', async () => {
  const alan = await login(DEMO_ACCOUNTS.alan.email, DEMO_ACCOUNTS.alan.password);
  const grace = await login(DEMO_ACCOUNTS.grace.email, DEMO_ACCOUNTS.grace.password);
  const teacher = await login(DEMO_ACCOUNTS.teacher.email, DEMO_ACCOUNTS.teacher.password);
  const pdfId = await upload(alan, Buffer.from(ONE_PAGE_PDF), 'drawing.pdf', 'application/pdf');
  const pngId = await upload(alan, ONE_PIXEL_PNG, 'sketch.png', 'image/png');
  const pdf = await json(`/api/submissions/${pdfId}`, teacher);
  assert.equal(pdf.body.markablePages, 1);
  const png = await json(`/api/submissions/${pngId}`, teacher);
  assert.equal(png.body.markablePages, 1);
  const text = await json(`/api/submissions/${await gradedSubmissionId(teacher)}`, teacher);
  assert.equal(text.body.markablePages, 0);

  const page = (documentId: string, n: number, token?: string) => fetch(`${base}/api/documents/${documentId}/pages/${n}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  const rendered = await page(pdf.body.submission.document.id, 1, teacher);
  assert.equal(rendered.status, 200);
  assert.equal(rendered.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await rendered.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
  assert.equal((await page(pdf.body.submission.document.id, 1, alan)).status, 200);
  assert.equal((await page(pdf.body.submission.document.id, 1, grace)).status, 403);
  assert.equal((await page(pdf.body.submission.document.id, 1)).status, 401);
  assert.equal((await page(pdf.body.submission.document.id, 2, teacher)).status, 404);
  assert.equal((await page(pdf.body.submission.document.id, 0, teacher)).status, 404);
  const image = await page(png.body.submission.document.id, 1, alan);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), ONE_PIXEL_PNG);

  const route = `/api/submissions/${pdfId}/annotations`;
  const strokes = [[{ x: 10, y: 20 }, { x: 40.5, y: 25 }, { x: 60, y: 50 }], [{ x: 15, y: 70 }, { x: 20, y: 75 }]];
  const drawing = await post(route, teacher, { type: 'FREE_DRAW', page: 1, strokeData: JSON.stringify(strokes), color: '#c0392b', content: 'Circle the claim' });
  assert.equal(drawing.status, 201);
  assert.deepEqual(JSON.parse(drawing.body.annotation.strokeData), strokes);
  assert.deepEqual([drawing.body.annotation.x, drawing.body.annotation.y, drawing.body.annotation.width, drawing.body.annotation.height], [10, 20, 50, 55]);
  const area = await post(route, teacher, { type: 'AREA', page: 1, x: 5, y: 5, width: 30, height: 20, content: 'This heading' });
  assert.equal(area.status, 201);
  for (const invalid of [
    { type: 'FREE_DRAW', page: 1, strokeData: '[]' },
    { type: 'FREE_DRAW', page: 1, strokeData: [[{ x: 10, y: 120 }]] },
    { type: 'FREE_DRAW', page: 2, strokeData: [[{ x: 10, y: 10 }]] },
    { type: 'AREA', page: 2, x: 5, y: 5, width: 10, height: 10 },
  ]) {
    assert.equal((await post(route, teacher, invalid)).status, 400, JSON.stringify(invalid));
  }
  assert.equal((await post(route, alan, { type: 'FREE_DRAW', page: 1, strokeData: strokes })).status, 403);

  const exported = await fetch(`${base}/api/submissions/${pdfId}/export`, { headers: { Authorization: `Bearer ${teacher}` } });
  assert.equal(exported.status, 200);

  const hugeId = await upload(alan, Buffer.from(ONE_PAGE_PDF.replace('[0 0 300 144]', '[0 0 14400 7200]')), 'poster.pdf', 'application/pdf');
  const huge = await json(`/api/submissions/${hugeId}`, teacher);
  const [one, two] = await Promise.all([page(huge.body.submission.document.id, 1, teacher), page(huge.body.submission.document.id, 1, teacher)]);
  assert.deepEqual([one.status, two.status], [200, 200]);
  const header = Buffer.from(await one.arrayBuffer());
  await two.arrayBuffer();
  const [width, height] = [header.readUInt32BE(16), header.readUInt32BE(20)];
  assert.ok(Math.max(width, height) <= 2000 && Math.max(width, height) >= 1900, `rendered ${width}x${height}`);
  const cached = await fs.readdir(path.join(uploadDir(), 'pages'));
  assert.equal(cached.some((name) => name.includes('.tmp-')), false);
});
