import { createClerkClient, type AuthObject, type ClerkClient } from "@clerk/backend";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "../env";

/**
 * Per-process Clerk client. Created lazily on first call so a missing
 * CLERK_SECRET_KEY in a dev process that's not using auth (e.g. a test
 * runner) doesn't crash the module.
 */
let _client: ClerkClient | null = null;
function client(): ClerkClient {
  if (_client) return _client;
  _client = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  return _client;
}

/**
 * Verify the incoming request's Clerk session and stash an auth object
 * on the Hono context. Drop this onto any router that wants to read
 * `c.get("auth")` to know the caller.
 *
 * Hand-rolled (rather than using @hono/clerk-auth) because:
 *  1. @hono/clerk-auth is deprecated (upstream moved to @clerk/hono).
 *  2. It reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY from c.env, which
 *     in @hono/node-server is { incoming, outgoing } — not process.env.
 *     Passing options works at runtime but isn't in the published types.
 *  3. Doing it ourselves is ~15 lines and unambiguous.
 */
export function clerkAuth(): MiddlewareHandler {
  return async (c, next) => {
    const requestState = await client().authenticateRequest(c.req.raw, {
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      acceptsToken: "any",
    });

    // Forward any Set-Cookie / handshake headers Clerk needs us to set.
    if (requestState.headers) {
      requestState.headers.forEach((value, key) => {
        c.res.headers.append(key, value);
      });
    }

    // Stash the auth payload on the context. `c.get("auth").userId` is the
    // canonical way to ask "who is the caller?".
    c.set("auth", requestState.toAuth());
    c.set("clerk", client());

    await next();
  };
}

/** The AuthObject Clerk returns — typed re-export for handlers. */
export type Auth = AuthObject;

/** Read the auth payload from a Hono context, or null if not authenticated. */
export function readAuth(c: Context) {
  return c.get("auth" as never) as AuthObject | undefined;
}

/** Returns the Clerk userId, or null if not authenticated. */
export function readUserId(c: Context): string | null {
  const auth = readAuth(c);
  // AuthObject is a discriminated union by tokenType; the session-token
  // variants always have a non-null userId, the others have userId: null.
  // Casting here is safe because the only callers that need a string are
  // gated by requireAuth() and route logic that already inspects tokenType.
  return (auth as { userId: string | null } | undefined)?.userId ?? null;
}

/** Get a Clerk client (for routes that need to call Clerk's API). */
export function getClerkClient(): ClerkClient {
  return client();
}
