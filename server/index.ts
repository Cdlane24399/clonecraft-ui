import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./env";
import { redisAvailable } from "./lib/redis";
import { runsRoute } from "./routes/runs";
import { projectsRoute } from "./routes/projects";

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ ok: true, redis: redisAvailable, env: env.NODE_ENV })
);

app.route("/api/runs", runsRoute);
app.route("/api/projects", projectsRoute);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 CloneCraft API on http://localhost:${info.port}`);
  console.log(`   Redis live-state: ${redisAvailable ? "on" : "off"}`);
});
