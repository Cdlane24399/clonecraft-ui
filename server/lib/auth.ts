import type { Context, MiddlewareHandler } from "hono";
import { readUserId } from "./clerk";

/**
 * 401s when no Clerk userId is on the request. Drop it onto any router
 * that requires authentication. For inline checks, use `requireUserId(c)`.
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    if (!readUserId(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}

/** Returns the Clerk userId, or throws a 401 Response. */
export function getUserId(c: Context): string {
  const userId = readUserId(c);
  if (!userId) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return userId;
}

export type { User } from "../db/schema";
