import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DB } from '../db/database';
import { forbidden, unauthorized } from '../http';

export type Role = 'teacher' | 'student' | 'admin';
export interface AuthUser { id: string; email: string; name: string; role: Role }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser; db: DB }
  }
}

export const SESSION_COOKIE = 'mysl8te_sid';
export const CSRF_HEADER = 'x-requested-with';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const scryptAsync = (password: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(db: DB, userId: string): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expiresAt.toISOString());
  return { token, expiresAt };
}

export function destroySession(db: DB, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function readToken(req: Request): { token: string; viaCookie: boolean } | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return { token: header.slice(7).trim(), viaCookie: false };
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return { token: decodeURIComponent(v.join('=')), viaCookie: true };
  }
  return null;
}

export function sessionToken(req: Request): string | null {
  return readToken(req)?.token ?? null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const t = readToken(req);
  if (!t) return next();
  const row = req.db
    .prepare(`SELECT u.id, u.email, u.name, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .get(sha256(t.token)) as (AuthUser & { expires_at: string }) | undefined;
  if (!row) return next();
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(req.db, t.token);
    return next();
  }
  // Cookie-authenticated state-changing requests must carry a custom header that cross-site forms cannot set.
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (t.viaCookie && mutating && req.headers[CSRF_HEADER] !== 'mysl8te') {
    return next(forbidden('Missing CSRF header'));
  }
  req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
  next();
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req: Request, ...roles: Role[]): AuthUser {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

const attempts = new Map<string, { count: number; resetAt: number }>();
export function checkLoginRateLimit(key: string, max = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}
export function clearLoginRateLimit(key: string): void {
  attempts.delete(key);
}
export function resetRateLimits(): void {
  attempts.clear();
}
