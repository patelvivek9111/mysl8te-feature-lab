import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import prisma from '../db/prisma';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface ResolvedSession {
  sessionId: string;
  user: AuthUser;
}

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 12);
const SESSION_IDLE_MS = Number(process.env.SESSION_IDLE_MS || 1000 * 60 * 60 * 2);
const LAST_USED_WRITE_INTERVAL_MS = 60_000;
const SCRYPT_KEYLEN = 32;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

const COMMON_PASSWORDS = new Set([
  'password1234', 'password12345', 'password123456', '123456789012', '1234567890123',
  'qwertyuiop12', 'qwerty123456', 'iloveyou1234', 'letmein12345', 'welcome12345',
  'administrator', 'changeme1234', 'passw0rd1234', 'trustno11234', 'abc123456789',
]);

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

// Precomputed so a login for an unknown email spends the same scrypt time as a real one.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, salt, hash] = (stored ?? '').split('$');
  const [, dummySalt, dummyHash] = DUMMY_HASH.split('$');
  const storedKey = Buffer.from(hash ?? '', 'hex');
  const usable = scheme === 'scrypt' && Boolean(salt) && storedKey.length > 0;
  const expected = usable ? storedKey : Buffer.from(dummyHash, 'hex');
  const actual = await scryptAsync(password, usable ? salt : dummySalt, expected.length);
  return usable && crypto.timingSafeEqual(actual, expected);
}

export function passwordPolicyErrors(password: string, context: { email?: string; name?: string } = {}): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);
  if (password.length > PASSWORD_MAX_LENGTH) errors.push(`Use at most ${PASSWORD_MAX_LENGTH} characters`);
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) errors.push('This password is too common');
  if (/^(.)\1+$/.test(password)) errors.push('Do not repeat a single character');
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidate = compact(password);
  const local = compact(context.email?.split('@')[0] ?? '');
  if (local.length >= 4 && candidate.includes(local)) errors.push('Do not include your email name');
  const nameParts = (context.name ?? '').split(/\s+/).map(compact).filter((part) => part.length >= 4);
  if (nameParts.some((part) => candidate.includes(part))) errors.push('Do not include your name');
  return errors;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  if (!token || token.length > 200) return null;
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.lastUsedAt.getTime() + SESSION_IDLE_MS <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now - session.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    await prisma.session.updateMany({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
  }
  return { sessionId: session.id, user: session.user };
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return result.count;
}

const PURGE_INTERVAL_MS = 60_000;
let lastPurgeAt = 0;

export async function purgeExpiredSessions(force = false): Promise<number> {
  if (!force && Date.now() - lastPurgeAt < PURGE_INTERVAL_MS) return 0;
  lastPurgeAt = Date.now();
  const result = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lte: new Date() } }, { lastUsedAt: { lte: new Date(Date.now() - SESSION_IDLE_MS) } }] },
  });
  return result.count;
}
