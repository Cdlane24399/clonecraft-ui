import { Hono } from "hono";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";

/**
 * Webhook routes. Each webhook verifies its own signature using a secret
 * stored in the environment; Clerk uses svix, Stripe uses a raw HMAC.
 *
 * These endpoints MUST NOT be behind requireAuth() — the upstream service
 * is the one authenticating, via the signature header.
 */
export const webhooksRoute = new Hono();

// POST /api/webhooks/clerk — user lifecycle events.
// Configure in Clerk dashboard: Webhooks → add endpoint → subscribe to
// user.created, user.updated, user.deleted. The signing secret goes in
// CLERK_WEBHOOK_SIGNING_SECRET.
webhooksRoute.post("/clerk", async (c) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    // 503 (Service Unavailable) signals "this endpoint exists but is not
    // configured" — distinct from 401 (not allowed) and 500 (crashed).
    return c.json(
      { error: "Clerk webhook signing secret not configured on this server" },
      503,
    );
  }

  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing svix headers" }, 400);
  }

  const rawBody = await c.req.text();
  const wh = new Webhook(secret);
  let event: { type: string; data: { id: string; deleted?: boolean } };
  try {
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch (err) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  switch (event.type) {
    case "user.deleted": {
      // Hard-delete the local row. Foreign keys (projects, runs) cascade.
      const id = event.data?.id;
      if (id) {
        await db.delete(users).where(eq(users.id, id));
      }
      return c.json({ ok: true });
    }
    case "user.created":
    case "user.updated": {
      // The /api/me handler does the upsert on the user's first call; we
      // accept these and no-op so events don't 500 in the dashboard.
      return c.json({ ok: true });
    }
    default:
      return c.json({ ok: true, ignored: event.type });
  }
});

// POST /api/webhooks/stripe — wired in Phase 3. The route is registered
// now so the Stripe CLI's `stripe listen --forward-to` works during dev.
webhooksRoute.post("/stripe", async (c) => {
  return c.json({ ok: false, error: "Stripe webhook not yet implemented" }, 501);
});
