// KAONASHI RATE LIMITER (§10.1, §10.6)

interface RateLimitRecord {
  attempts: number[];
  lockedUntil?: number;
}

const store: Map<string, RateLimitRecord> = new Map();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
}

export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): RateLimitResult {
  const now = Date.now();
  let record = store.get(key);

  if (!record) {
    record = { attempts: [] };
    store.set(key, record);
  }

  // Check if actively locked
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      attemptsLeft: 0,
    };
  }

  // Filter out expired timestamps
  record.attempts = record.attempts.filter((t) => now - t < windowMs);

  if (record.attempts.length >= maxAttempts) {
    // 15 min lockout
    record.lockedUntil = now + windowMs;
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      attemptsLeft: 0,
    };
  }

  return {
    allowed: true,
    attemptsLeft: maxAttempts - record.attempts.length,
  };
}

export function recordFailedAttempt(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): RateLimitResult {
  const now = Date.now();
  let record = store.get(key);
  if (!record) {
    record = { attempts: [] };
    store.set(key, record);
  }
  record.attempts.push(now);
  return checkRateLimit(key, maxAttempts, windowMs);
}

export function clearRateLimit(key: string): void {
  store.delete(key);
}
