import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { env } from "./env";
import { redisAvailable } from "./lib/redis";
import { runsRoute } from "./routes/runs";
import { projectsRoute } from "./routes/projects";
import { meRoute } from "./routes/me";
import { webhooksRoute } from "./routes/webhooks";
import { abuseRoute } from "./routes/abuse";
import { clerkAuth, readUserId } from "./lib/clerk";
import { securityHeaders } from "./lib/security";
import { rateLimit, userOrIpKey } from "./lib/ratelimit";
import { db } from "./db/client";
import { users } from "./db/schema";

const app = new Hono();

// ── Global error handler ─────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}]`, err);
  return c.json(
    {
      error: err.message || "Internal Server Error",
      ...(env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    },
    500,
  );
});

// ── Security headers (CSP, HSTS, X-CTO, Referrer-Policy, etc.) ──────────
app.use("/api/*", securityHeaders());

// ── CORS — only the frontend origin can call us cross-origin ────────────
// In dev, the Vite proxy makes same-origin; this CORS config is for prod
// where the Vercel frontend and Fly API are on different domains.
app.use(
  "/api/*",
  cors({
    origin: env.VITE_APP_URL,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type", "authorization", "svix-id", "svix-timestamp", "svix-signature"],
    credentials: true,
    maxAge: 86400,
  }),
);

// ── Body size limit: 1 MB on JSON bodies ────────────────────────────────
// Generous enough for any legitimate config; tiny enough to blunt
// "send me 1GB of JSON" abuse. Streaming media isn't an /api/* concern.
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "Request body too large (max 1 MB)" }, 413),
  }),
);

// ── Public health (no auth, no Clerk middleware) ────────────────────────
app.get("/api/health", (c) =>
  c.json({ ok: true, redis: redisAvailable, env: env.NODE_ENV })
);

// ── Clerk auth — populates c.get("auth") for everything else ────────────
app.use("/api/*", clerkAuth());

// ── Per-IP rate limit on the abuse endpoint (anonymity preserved) ───────
// Higher limit so legitimate reporting isn't blocked, but capped so
// this can't be used as a log-spammer.
app.use(
  "/api/abuse",
  rateLimit({
    bucket: "abuse",
    windowMs: 60 * 60 * 1000,
    max: 30,
  }),
);

// ── Webhooks verify their own signatures (no Clerk gate) ───────────────
app.route("/api/webhooks", webhooksRoute);

// ── Ensure local FK target exists before authenticated routes write rows ─
app.use("/api/*", async (c, next) => {
  const userId = readUserId(c);
  if (userId) {
    try {
      await db
        .insert(users)
        .values({ id: userId })
        .onConflictDoNothing({ target: users.id });
    } catch (err) {
      console.error("users upsert failed:", err);
    }
  }
  await next();
});

// ── Authed routes ──────────────────────────────────────────────────────
app.route("/api/me", meRoute);
app.route("/api/runs", runsRoute);
app.route("/api/projects", projectsRoute);

// ── Public abuse endpoint (after Clerk so we can attribute, but
//    no requireAuth — anonymous reports are allowed).
app.route("/api/abuse", abuseRoute);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 CloneCraft API on http://localhost:${info.port}`);
  console.log(`   Redis live-state: ${redisAvailable ? "on" : "off"}`);
});
