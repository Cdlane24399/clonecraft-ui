import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { requireAuth, getUserId } from "../lib/auth";
import { getClerkClient } from "../lib/clerk";

export const meRoute = new Hono();

meRoute.use("*", requireAuth());

/**
 * GET /api/me — returns the caller's profile (Clerk → DB merge).
 *
 * Clerk is the source of truth for identity. We keep a thin row in `users`
 * so we can FK from `projects` and `runs`, and so the consent record has
 * a place to live. This endpoint refreshes that row from Clerk on each
 * call (cheap) and returns the merged view.
 */
meRoute.get("/", async (c) => {
  const userId = getUserId(c);
  const clerk = getClerkClient();
  const clerkUser = await clerk.users.getUser(userId);

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;
  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    email ||
    "User";
  const avatarUrl = clerkUser.imageUrl || null;

  await db
    .insert(users)
    .values({ id: userId, email, displayName, avatarUrl })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        displayName,
        avatarUrl,
        updatedAt: new Date(),
      },
    });

  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return c.json(row);
});
