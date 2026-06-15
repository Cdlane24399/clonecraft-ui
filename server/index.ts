import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./env";
import { redisAvailable } from "./lib/redis";
import { runsRoute } from "./routes/runs";
import { projectsRoute } from "./routes/projects";
import { meRoute } from "./routes/me";
import { webhooksRoute } from "./routes/webhooks";
import { clerkAuth, readUserId } from "./lib/clerk";
import { db } from "./db/client";
import { users } from "./db/schema";
const app = new Hono();

// ── Global error handler ─────────────────────────────────────────────────
// Without this, unhandled throws in middleware (e.g. Clerk's "Missing
// Publishable key" during dev with a misconfigured .env) surface as a
// generic `Internal Server Error` HTML. We want JSON so the frontend can
// show something sensible, and we want to log the cause so the dev console
// isn't silent.
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}]`, err);
  return c.json(
    {
      error: err.message || "Internal Server Error",
      // Only echo the stack in development.
      ...(env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    },
    500,
  );
});

// Public, no auth — used by deploy probes and uptime monitors. Mounted
// BEFORE the global Clerk middleware so health checks never depend on
// Clerk being reachable.
app.get("/api/health", (c) =>
  c.json({ ok: true, redis: redisAvailable, env: env.NODE_ENV })
);

// Apply Clerk auth globally so every /api/* route (except /api/health) can
// read the user. Routes that require auth opt in via requireAuth().
//
// The `clerkAuth()` here is our hand-rolled middleware in ./lib/clerk, not
// @hono/clerk-auth (which is deprecated and reads from c.env, which in
// @hono/node-server is { incoming, outgoing }, not process.env).
app.use("/api/*", clerkAuth());

// Webhooks verify their own signatures (svix for Clerk, raw body for Stripe)
// so they must NOT be gated by requireAuth(). Clerk's clerkMiddleware()
// doesn't 401 unauthenticated requests on its own — it just leaves
// c.get("clerkAuth")() returning null — so the requireAuth() inside
// /api/runs and /api/projects is what 401s the unauth requests.
app.route("/api/webhooks", webhooksRoute);
app.route("/api/me", meRoute);
app.route("/api/runs", runsRoute);
app.route("/api/projects", projectsRoute);

// Eagerly upsert the user row on first authenticated request of each call.
// Cheap (single SQL) and means we never have a Clerk user with no DB record
// by the time they hit /api/runs.
app.use("/api/*", async (c, next) => {
  const userId = readUserId(c);
  if (userId) {
    // Fire and forget — the request shouldn't wait for the upsert, and a
    // failure here just means we'll retry on the next call. Catch inside
    // the IIFE so a Drizzle/network blip never bubbles into a 500.
    void (async () => {
      try {
        await db
          .insert(users)
          .values({ id: userId })
          .onConflictDoNothing({ target: users.id });
      } catch (err) {
        console.error("users upsert failed:", err);
      }
    })();
  }
  await next();
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 CloneCraft API on http://localhost:${info.port}`);
  console.log(`   Redis live-state: ${redisAvailable ? "on" : "off"}`);
});
