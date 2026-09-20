import { env, waitUntil } from "cloudflare:workers";

export class RateLimitUnavailableError extends Error {}

type RateLimitRule = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

type CountRow = { count: number };

export function clientIpKey(request: Request) {
  const value = request.headers.get("cf-connecting-ip")?.trim();
  return value || null;
}

export async function checkRateLimits(rules: RateLimitRule[]): Promise<RateLimitResult> {
  const db = env.DB;
  if (!db) throw new RateLimitUnavailableError("D1 binding DB is unavailable.");

  const now = Math.floor(Date.now() / 1000);
  const statements = rules.flatMap((rule) => {
    const windowStart = Math.floor(now / rule.windowSeconds) * rule.windowSeconds;
    const key = `${rule.scope}:${rule.identifier}`;

    return [
      db.prepare(`
        INSERT INTO rate_limits (key, window_start, count)
        VALUES (?, ?, 1)
        ON CONFLICT(key) DO UPDATE SET
          window_start = excluded.window_start,
          count = CASE
            WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1
            ELSE 1
          END
      `).bind(key, windowStart),
      db.prepare("SELECT count FROM rate_limits WHERE key = ?").bind(key),
    ];
  });

  try {
    const results = await db.batch(statements);

    if (Math.random() < 0.01) {
      const cutoff = now - 2 * 24 * 60 * 60;
      try {
        waitUntil(
          db.prepare("DELETE FROM rate_limits WHERE window_start < ?")
            .bind(cutoff)
            .run()
            .catch((error) => {
              console.warn("Studify rate limit cleanup failed", {
                errorName: error instanceof Error ? error.name : "unknown",
              });
            }),
        );
      } catch (error) {
        console.warn("Studify rate limit cleanup failed", {
          errorName: error instanceof Error ? error.name : "unknown",
        });
      }
    }

    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      const row = results[index * 2 + 1]?.results?.[0] as CountRow | undefined;
      const count = Number(row?.count ?? 0);
      if (count > rule.limit) {
        const windowStart = Math.floor(now / rule.windowSeconds) * rule.windowSeconds;
        return { allowed: false, retryAfter: Math.max(1, windowStart + rule.windowSeconds - now) };
      }
    }
    return { allowed: true };
  } catch (error) {
    console.warn("Studify rate limit unavailable", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    throw new RateLimitUnavailableError("Rate limit storage unavailable.");
  }
}
