import { describe, expect, it } from 'vitest';
import { hashPassword, hashPasswordAsync, hashToken, passwordPolicyErrors, verifyPassword } from './auth';
import { FailureLimiter, clientAddressKey } from './rateLimit';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = hashPassword('Correct-Horse-Battery-2026');
    expect(await verifyPassword('Correct-Horse-Battery-2026', stored)).toBe(true);
    expect(await verifyPassword('Correct-Horse-Battery-2025', stored)).toBe(false);
    expect(await verifyPassword('Correct-Horse-Battery-2026', await hashPasswordAsync('Correct-Horse-Battery-2026'))).toBe(true);
  });

  it('rejects missing or malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('anything', undefined)).toBe(false);
    expect(await verifyPassword('anything', 'plaintext')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$salt$zz')).toBe(false);
    expect(await verifyPassword('anything', 'bcrypt$salt$abcd')).toBe(false);
  });

  it('hashes tokens deterministically without exposing them', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toContain('abc');
  });
});

describe('password policy', () => {
  it('accepts a long unique passphrase', () => {
    expect(passwordPolicyErrors('Correct-Horse-Battery-2026', { email: 'ada@demo.lab', name: 'Ada Lovelace' })).toEqual([]);
  });

  it('rejects short, common, repeated, and personal passwords', () => {
    expect(passwordPolicyErrors('short')).toContain('Use at least 12 characters');
    expect(passwordPolicyErrors('x'.repeat(201))).toContain('Use at most 200 characters');
    expect(passwordPolicyErrors('Password1234')).toContain('This password is too common');
    expect(passwordPolicyErrors('zzzzzzzzzzzzzz')).toContain('Do not repeat a single character');
    expect(passwordPolicyErrors('my-grace-hopper-pass', { email: 'grace.hopper@demo.lab' })).toContain('Do not include your email name');
    expect(passwordPolicyErrors('lovelace-forever-2026', { name: 'Lovelace' })).toContain('Do not include your name');
  });
});

describe('clientAddressKey', () => {
  it('keeps IPv4 addresses and unwraps IPv4-mapped IPv6', () => {
    expect(clientAddressKey('203.0.113.9')).toBe('203.0.113.9');
    expect(clientAddressKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(clientAddressKey(undefined)).toBe('unknown');
  });

  it('groups IPv6 addresses by /64', () => {
    expect(clientAddressKey('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(clientAddressKey('2001:0db8:0001:0002:ffff:eeee:dddd:cccc')).toBe('2001:db8:1:2::/64');
    expect(clientAddressKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(clientAddressKey('::1')).toBe('0:0:0:0::/64');
  });
});

describe('FailureLimiter', () => {
  it('release undoes a provisional failure', () => {
    const limiter = new FailureLimiter(1, 60_000);
    limiter.recordFailure('k', 0);
    limiter.release('k');
    expect(limiter.retryAfterSeconds('k', 1)).toBe(0);
  });

  it('blocks only after the failure budget is spent and expires with the window', () => {
    const limiter = new FailureLimiter(3, 1000);
    const now = 1_000_000;
    for (let i = 0; i < 2; i += 1) limiter.recordFailure('k', now);
    expect(limiter.retryAfterSeconds('k', now)).toBe(0);
    limiter.recordFailure('k', now);
    expect(limiter.retryAfterSeconds('k', now)).toBe(1);
    expect(limiter.retryAfterSeconds('other', now)).toBe(0);
    expect(limiter.retryAfterSeconds('k', now + 1000)).toBe(0);
  });

  it('clears a key on success and caps memory use', () => {
    const limiter = new FailureLimiter(1, 60_000, 5);
    limiter.recordFailure('k', 0);
    expect(limiter.retryAfterSeconds('k', 1)).toBeGreaterThan(0);
    limiter.clear('k');
    expect(limiter.retryAfterSeconds('k', 1)).toBe(0);
    for (let i = 0; i < 50; i += 1) limiter.recordFailure(`key-${i}`, 0);
    expect((limiter as unknown as { entries: Map<string, unknown> }).entries.size).toBeLessThanOrEqual(5);
  });
});
