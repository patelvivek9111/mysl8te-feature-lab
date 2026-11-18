import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, loginLimiters, passwordChangeLimiter } from './app';
import { hashPassword, hashToken } from './services/auth';
import prisma from './db/prisma';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

let server: Server;
let base = '';
const EMAIL = 'auth-hardening@demo.lab';
const PASSWORD = 'AuthHardening!2026';

async function post(path: string, body: unknown, token?: string, raw?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { method: 'POST', headers, body: raw ?? JSON.stringify(body) });
  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  return { status: response.status, body: parsed, headers: response.headers };
}

async function me(token: string): Promise<number> {
  const response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  return response.status;
}

async function login(email = EMAIL, password = PASSWORD): Promise<string> {
  const response = await post('/api/auth/login', { email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body!.token as string;
}

async function resetUser(): Promise<void> {
  const institution = await prisma.institution.upsert({ where: { domain: 'demo.lab' }, update: {}, create: { name: 'Demo College', domain: 'demo.lab' } });
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: hashPassword(PASSWORD), role: 'TEACHER' },
    create: { email: EMAIL, name: 'Auth Hardening', role: 'TEACHER', passwordHash: hashPassword(PASSWORD), institutionId: institution.id },
  });
}

test.before(async () => {
  await resetUser();
  const app = createApp();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.beforeEach(() => {
  loginLimiters.account.reset();
  loginLimiters.address.reset();
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test('login issues an opaque token and stores only its hash', async () => {
  const token = await login();
  assert.equal(token.includes('.'), false);
  assert.equal(Buffer.from(token, 'base64url').toString('utf8').includes(EMAIL), false);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  const rows = await prisma.session.findMany({ where: { userId: user.id } });
  assert.equal(rows.some((row) => row.tokenHash === token), false);
  assert.equal(rows.some((row) => row.tokenHash === hashToken(token)), true);
  assert.equal(await me(token), 200);
});

test('logout revokes only the current session; logout-all revokes every session', async () => {
  const first = await login();
  const second = await login();
  assert.equal((await post('/api/auth/logout', {}, first)).status, 200);
  assert.equal(await me(first), 401);
  assert.equal(await me(second), 200);
  assert.equal((await post('/api/auth/logout', {}, first)).status, 401);

  const third = await login();
  const all = await post('/api/auth/logout-all', {}, second);
  assert.equal(all.status, 200);
  assert.ok((all.body!.revoked as number) >= 2);
  assert.equal(await me(second), 401);
  assert.equal(await me(third), 401);
});

test('expired and idle sessions are rejected and deleted', async () => {
  const expired = await login();
  await prisma.session.update({ where: { tokenHash: hashToken(expired) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await me(expired), 401);
  assert.equal(await prisma.session.count({ where: { tokenHash: hashToken(expired) } }), 0);

  const idle = await login();
  await prisma.session.update({ where: { tokenHash: hashToken(idle) }, data: { lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 24) } });
  assert.equal(await me(idle), 401);
  assert.equal(await prisma.session.count({ where: { tokenHash: hashToken(idle) } }), 0);

  assert.equal(await me('not-a-real-token'), 401);
  assert.equal(await me('x'.repeat(5000)), 401);
});

test('unknown email and wrong password give identical responses', async () => {
  const unknown = await post('/api/auth/login', { email: 'nobody-here@demo.lab', password: 'WrongPassword!2026' });
  const wrong = await post('/api/auth/login', { email: EMAIL, password: 'WrongPassword!2026' });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(unknown.body, wrong.body);
});

test('repeated failures are rate limited per address and email, even with the right password', async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await post('/api/auth/login', { email: EMAIL, password: `Wrong-${attempt}-password` })).status, 401);
  }
  const blocked = await post('/api/auth/login', { email: EMAIL, password: PASSWORD });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  const other = await post('/api/auth/login', { email: 'nobody-here@demo.lab', password: 'WrongPassword!2026' });
  assert.equal(other.status, 401);

  loginLimiters.account.reset();
  for (let attempt = 0; attempt < 9; attempt += 1) {
    await post('/api/auth/login', { email: EMAIL, password: `Wrong-${attempt}-password` });
  }
  await login();
  assert.equal((await post('/api/auth/login', { email: EMAIL, password: 'Wrong-again-password' })).status, 401);
});

test('concurrent wrong guesses cannot exceed the failure budget', async () => {
  const results = await Promise.all(Array.from({ length: 25 }, (_, attempt) => post('/api/auth/login', { email: EMAIL, password: `Parallel-${attempt}-guess` })));
  const statuses = results.map((result) => result.status);
  assert.equal(statuses.filter((status) => status === 401).length, 10);
  assert.equal(statuses.filter((status) => status === 429).length, 15);
});

test('guessing the current password on the change endpoint is rate limited', async (t) => {
  t.after(() => passwordChangeLimiter.reset());
  const token = await login();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrong = await post('/api/auth/password', { currentPassword: `Wrong-${attempt}-current`, newPassword: 'Correct-Horse-Battery-2026' }, token);
    assert.equal(wrong.status, 403);
  }
  const blocked = await post('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'Correct-Horse-Battery-2026' }, token);
  assert.equal(blocked.status, 429);
  assert.equal(await prisma.auditLog.count({ where: { action: 'password_change_failed', entityId: (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).id } }) >= 5, true);
  await login();
});

test('password change enforces policy, needs the current password, and revokes other sessions', async (t) => {
  t.after(resetUser);
  await prisma.session.deleteMany({ where: { user: { email: EMAIL } } });
  const current = await login();
  const other = await login();
  const newPassword = 'Correct-Horse-Battery-2026';

  const wrongCurrent = await post('/api/auth/password', { currentPassword: 'nope-nope-nope', newPassword }, current);
  assert.equal(wrongCurrent.status, 403);
  for (const weak of ['short1!', 'password1234', 'aaaaaaaaaaaaaaaa', 'my-auth-hardening-pass', PASSWORD]) {
    const rejected = await post('/api/auth/password', { currentPassword: PASSWORD, newPassword: weak }, current);
    assert.equal(rejected.status, 400, weak);
  }
  const changed = await post('/api/auth/password', { currentPassword: PASSWORD, newPassword }, current);
  assert.equal(changed.status, 200);
  assert.equal(changed.body!.revokedOtherSessions, 1);
  assert.equal(await me(current), 200);
  assert.equal(await me(other), 401);
  assert.equal((await post('/api/auth/login', { email: EMAIL, password: PASSWORD })).status, 401);
  await login(EMAIL, newPassword);
  const audit = await prisma.auditLog.findFirst({ where: { action: 'password_change' }, orderBy: { createdAt: 'desc' } });
  assert.ok(audit);
  assert.equal(JSON.stringify(audit.changes).includes(newPassword), false);
});

test('malformed, oversized, and non-string bodies are rejected without a server error', async () => {
  assert.equal((await post('/api/auth/login', null, undefined, '{"email":')).status, 400);
  assert.equal((await post('/api/auth/login', null, undefined, JSON.stringify({ email: 'a'.repeat(1_100_000) }))).status, 413);
  assert.equal((await post('/api/auth/login', { email: { $ne: null }, password: ['x'] })).status, 400);
  assert.equal((await post('/api/auth/login', { email: EMAIL, password: 'p'.repeat(5000) })).status, 400);
});

test('uploads beyond the size limit get 413, and unauthenticated uploads are refused before parsing', async () => {
  const token = await login();
  const form = new FormData();
  form.append('file', new Blob([Buffer.alloc(Number(process.env.MAX_FILE_SIZE || 26_214_400) + 1, 0x61)]), 'big.txt');
  const big = await fetch(`${base}/api/assignments/00000000-0000-0000-0000-000000000000/submissions`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  assert.equal(big.status, 413);

  const twoFiles = new FormData();
  twoFiles.append('file', new Blob(['a']), 'a.txt');
  twoFiles.append('file', new Blob(['b']), 'b.txt');
  const multiple = await fetch(`${base}/api/assignments/00000000-0000-0000-0000-000000000000/submissions`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: twoFiles,
  });
  assert.equal(multiple.status, 400);

  const anonymous = new FormData();
  anonymous.append('file', new Blob(['hello']), 'a.txt');
  const refused = await fetch(`${base}/api/assignments/00000000-0000-0000-0000-000000000000/submissions`, { method: 'POST', body: anonymous });
  assert.equal(refused.status, 401);
});

test('security headers are set and unknown API routes return JSON 404', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const missing = await fetch(`${base}/api/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Not found' });
});
