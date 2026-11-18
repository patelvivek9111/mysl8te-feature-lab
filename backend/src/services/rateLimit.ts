interface Entry {
  count: number;
  resetAt: number;
}

// Counts failures only, so successful sign-ins from a shared address never lock anyone out.
export class FailureLimiter {
  private entries = new Map<string, Entry>();

  constructor(private readonly maxFailures: number, private readonly windowMs: number, private readonly maxKeys = 10_000) {}

  retryAfterSeconds(key: string, now = Date.now()): number {
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) return 0;
    return entry.count >= this.maxFailures ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }

  recordFailure(key: string, now = Date.now()): void {
    if (this.entries.size >= this.maxKeys) this.prune(now);
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count += 1;
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  reset(): void {
    this.entries.clear();
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    if (this.entries.size >= this.maxKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}
