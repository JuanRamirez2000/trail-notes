/**
 * Request guards for routes that change something. Plain functions over the standard Request so
 * they can be unit-tested without a server.
 */

/**
 * True when a state-changing request comes from our own pages. Browsers send `Origin` on every
 * POST/PUT; if another site makes a signed-in editor's browser call our API, the origins differ.
 * A missing Origin (curl, scripts) is refused too: the editor is only driven from its own pages.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** A small fixed-window rate limiter. Per server instance, so it's a brake on a runaway client, not a hard quota. */
export function rateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string, now = Date.now()): boolean {
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 1000) for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}
