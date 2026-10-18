import crypto from 'node:crypto';
import { Router } from 'express';
import {
  SESSION_COOKIE, checkLoginRateLimit, clearLoginRateLimit, createSession, destroySession, hashPassword,
  requireUser, sessionToken, verifyPassword, type Role,
} from '../auth/auth';
import { HttpError, ah, badRequest, str, unauthorized } from '../http';
import { audit } from '../audit';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Precomputed so unknown-email logins spend the same scrypt time as real ones.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function setCookie(res: import('express').Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  });
}

router.post('/register', ah((req, res) => {
  const email = str(req.body?.email, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest('email is invalid');
  const name = str(req.body?.name, 'name', { min: 1, max: 120 });
  const password = str(req.body?.password, 'password', { min: 8, max: 200, trim: false });
  const role = (req.body?.role ?? 'student') as Role;
  if (role !== 'teacher' && role !== 'student') throw badRequest('role must be teacher or student');
  const exists = req.db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  if (exists) throw new HttpError(409, 'An account with this email already exists');
  const id = crypto.randomUUID();
  req.db.prepare('INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)').run(id, email, name, role, hashPassword(password));
  const { token, expiresAt } = createSession(req.db, id);
  setCookie(res, token, expiresAt);
  audit(req.db, id, 'register', 'user', id);
  res.status(201).json({ user: { id, email, name, role }, token });
}));

router.post('/login', ah((req, res) => {
  const email = str(req.body?.email, 'email', { max: 254 }).toLowerCase();
  const password = str(req.body?.password, 'password', { max: 200, trim: false });
  const key = `${req.ip}|${email}`;
  if (!checkLoginRateLimit(key)) throw new HttpError(429, 'Too many login attempts. Try again later.');
  const user = req.db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').get(email) as
    | { id: string; email: string; name: string; role: Role; password_hash: string } | undefined;
  const ok = verifyPassword(password, user?.password_hash ?? DUMMY_HASH) && !!user;
  if (!ok || !user) throw unauthorized('Invalid email or password');
  clearLoginRateLimit(key);
  const { token, expiresAt } = createSession(req.db, user.id);
  setCookie(res, token, expiresAt);
  audit(req.db, user.id, 'login', 'user', user.id);
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
}));

router.post('/logout', ah((req, res) => {
  const token = sessionToken(req);
  if (token) destroySession(req.db, token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}));

router.get('/me', ah((req, res) => {
  res.json({ user: requireUser(req) });
}));

export default router;
