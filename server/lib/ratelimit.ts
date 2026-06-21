import type { Context, MiddlewareHandler } from "hono";
import { Redis } from "@upstash/redis";
import { env } from "../env";

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 *
 * Key shape: `cc:rl:<bucket>:<windowId>:<key>`  (windowId = floor(now / windowMs))
 * Value:     an integer (the request count for that window)
 *
 * We increment atomically with INCR (Redis is single-threaded) and
 * expire the key after the window length. The first request that
 * crosses the threshold gets a 429.
 *
 * Why a hand-rolled limiter instead of a third-party package? Three
 * reasons:
 *   1. No new dependency for ~40 lines of code.
 *   2. We already pay for Upstash; using it for rate limits is "free".
 *   3. The behavior is auditable in one file.
 */

let _redis: Redis | null = null;
function redis(): Redis | null {
  if (_redis) return _redis;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

export type RateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per window. */
  max: number;
  /**
   * Bucket name. Use distinct names for distinct limits (e.g. "runs" vs
   * "auth-attempt"). Concatenated with the caller key.
   */
  bucket: string;
  /**
   * How to extract the rate-limit key from the request. Default:
   * authenticated userId if present, else client IP from X-Forwarded-For
   * or the raw socket.
   */
  keyFn?: (c: Context) => string | null;
};

const TTL_SECONDS_BUFFER = 5; // small grace so the key doesn't expire mid-window

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const r = redis();
    // If Redis isn't configured, fail open: log a warning and let the
    // request through. We don't want a misconfigured Redis to take down
    // the API. (The plan calls out making this configurable later.)
    if (!r) {
      console.warn(`[ratelimit] Redis not configured; skipping ${opts.bucket} limit`);
      return next();
    }

    const key = opts.keyFn?.(c) ?? defaultKey(c);
    if (!key) {
      // No key = no limit (e.g. /api/health with no IP info). Fail open.
      return next();
    }

    const windowId = Math.floor(Date.now() / opts.windowMs);
    const redisKey = `cc:rl:${opts.bucket}:${windowId}:${key}`;
    const count = await r.incr(redisKey);
    if (count === 1) {
      // First write — set the TTL.
      await r.expire(redisKey, Math.ceil(opts.windowMs / 1000) + TTL_SECONDS_BUFFER);
    }
    if (count > opts.max) {
      const resetIn = (windowId + 1) * opts.windowMs - Date.now();
      c.header("Retry-After", String(Math.ceil(resetIn / 1000)));
      c.header("X-RateLimit-Limit", String(opts.max));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil(resetIn / 1000)));
      return c.json(
        {
          error: "Too many requests",
          retryAfterSeconds: Math.ceil(resetIn / 1000),
        },
        429,
      );
    }

    c.header("X-RateLimit-Limit", String(opts.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, opts.max - count)));
    await next();
  };
}

function defaultKey(c: Context): string | null {
  // 1. Authenticated user (if a previous middleware put userId on the context).
  //    We read from a custom key the auth middleware sets; fall back to
  //    nothing if the route isn't authed.
  // 2. X-Forwarded-For (first hop) — set by Vercel/Fly proxies.
  // 3. Raw socket IP via @hono/node-server's c.env.incoming.
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = c.req.header("x-real-ip");
  if (real) return real;
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming?.socket?.remoteAddress;
  if (incoming) return incoming;
  return null;
}

/**
 * Returns the authenticated Clerk userId from the request context, if any.
 * Used as a `keyFn` for routes that should be rate-limited per-user.
 */
export function userIdKey(c: Context): string | null {
  // The auth middleware (clerkAuth in ./clerk) populates c.get("auth").
  // We reach for it via a duck-typed cast to avoid a circular import.
  const auth = c.get("auth" as never) as { userId?: string | null } | undefined;
  return auth?.userId ?? null;
}

/**
 * Composite key: prefer userId, fall back to IP. This is the right
 * behavior for "10 runs/hour/user, but also cap anonymous traffic at
 * some lower rate" — though in our model every /api/runs is authed, so
 * the IP fallback is mostly defensive.
 */
export function userOrIpKey(c: Context): string | null {
  return userIdKey(c) ?? defaultKey(c);
}
