// Simple rate limiting for login PIN attempts (Section 27)

const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
const MAX_FAILED_ATTEMPTS = 5;

export async function checkLoginRateLimit(
  db: D1Database,
  phone: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const key = `ratelimit_${phone.replace(/\D/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const record = await db
      .prepare('SELECT attempts, first_attempt_at, last_attempt_at FROM auth_rate_limits WHERE key = ?')
      .bind(key)
      .first<{ attempts: number; first_attempt_at: number; last_attempt_at: number }>();

    if (!record) {
      return { allowed: true };
    }

    // Reset window if expired
    if (now - record.first_attempt_at > RATE_LIMIT_WINDOW_SECONDS) {
      await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
      return { allowed: true };
    }

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      const remainingSeconds = RATE_LIMIT_WINDOW_SECONDS - (now - record.first_attempt_at);
      return { allowed: false, retryAfterSeconds: Math.max(remainingSeconds, 1) };
    }

    return { allowed: true };
  } catch {
    // Fail open in case table is unavailable so legitimate users aren't locked out by DB errors
    return { allowed: true };
  }
}

export async function recordFailedLogin(db: D1Database, phone: string): Promise<void> {
  const key = `ratelimit_${phone.replace(/\D/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const existing = await db
      .prepare('SELECT attempts, first_attempt_at FROM auth_rate_limits WHERE key = ?')
      .bind(key)
      .first<{ attempts: number; first_attempt_at: number }>();

    if (!existing) {
      await db
        .prepare('INSERT INTO auth_rate_limits (key, attempts, first_attempt_at, last_attempt_at) VALUES (?, 1, ?, ?)')
        .bind(key, now, now)
        .run();
    } else {
      await db
        .prepare('UPDATE auth_rate_limits SET attempts = attempts + 1, last_attempt_at = ? WHERE key = ?')
        .bind(now, key)
        .run();
    }
  } catch {
    // Ignore error
  }
}

export async function clearLoginRateLimit(db: D1Database, phone: string): Promise<void> {
  const key = `ratelimit_${phone.replace(/\D/g, '')}`;
  try {
    await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
  } catch {
    // Ignore error
  }
}
