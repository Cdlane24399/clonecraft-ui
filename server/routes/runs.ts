import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { runs, projects } from "../db/schema";
import type { RunConfig } from "../db/schema";
import { getLive } from "../lib/redis";
import { runPipeline } from "../pipeline/run";
import { buildAndPreview } from "../lib/sandbox";
import { screenshotUrl } from "../lib/browser";
import { requireAuth, getUserId } from "../lib/auth";

export const runsRoute = new Hono();

const createSchema = z.object({
  url: z.string().url(),
  depth: z.enum(["landing", "top5", "full"]).default("top5"),
  stack: z.enum(["react", "next", "html"]).default("react"),
  goal: z.enum(["recreate", "redesign", "rebrand", "saas"]).default("recreate"),
  opts: z.record(z.boolean()).default({}),
});

function projectNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1) + " Clone";
  } catch {
    return "New Clone";
  }
}

// All routes on this router require an authenticated user. (Health is on a
// separate router so the deploy probe never depends on Clerk being live.)
runsRoute.use("*", requireAuth());

// POST /api/runs — start a real clone run, scoped to the caller.
runsRoute.post("/", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }
  const { url, depth, stack, goal, opts } = parsed.data;
  const config: RunConfig = { depth, stack, goal, opts };

  const [project] = await db
    .insert(projects)
    .values({ userId, name: projectNameFromUrl(url), url })
    .returning();

  const [run] = await db
    .insert(runs)
    .values({ userId, projectId: project.id, url, config, status: "queued" })
    .returning();

  // Kick off the pipeline in the background; respond immediately with the id.
  void runPipeline(run.id, url, config);

  return c.json({ id: run.id, projectId: project.id, status: run.status }, 201);
});

// GET /api/runs/:id — live status for a run the caller owns.
runsRoute.get("/:id", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");
  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.userId !== userId) {
    // Don't leak existence to non-owners.
    return c.json({ error: "Run not found" }, 404);
  }

  const live = await getLive(id);
  return c.json({
    id: run.id,
    url: run.url,
    config: run.config,
    status: live?.status ?? run.status,
    progress: live?.progress ?? run.progress,
    stage: live?.stage ?? run.currentStage ?? "",
    logs: live?.logs ?? [],
    error: run.error,
    // Result is only meaningful once finished; keep the live payload light.
    result: run.status === "succeeded" ? run.result : null,
  });
});

// POST /api/runs/:id/preview — (re)launch a live preview sandbox for a finished
// run the caller owns. Preview sandboxes expire, so this rebuilds the stored
// files in a fresh sandbox and returns a new public URL.
runsRoute.post("/:id/preview", async (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");
  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!run) return c.json({ error: "Run not found" }, 404);
  if (run.userId !== userId) {
    return c.json({ error: "Run not found" }, 404);
  }
  if (run.status !== "succeeded" || !run.result) {
    return c.json({ error: "Run has no generated files to preview" }, 400);
  }

  const preview = await buildAndPreview(run.result.files);
  if (!preview.previewUrl) {
    return c.json({ error: preview.build.output || "Preview unavailable" }, 502);
  }

  let renderedScreenshotDataUrl = run.result.renderedScreenshotDataUrl;
  try {
    renderedScreenshotDataUrl = `data:image/png;base64,${await screenshotUrl(preview.previewUrl)}`;
  } catch {
    /* keep the previous screenshot if re-capture fails */
  }

  const result = {
    ...run.result,
    build: preview.build,
    previewUrl: preview.previewUrl,
    sandboxId: preview.sandboxId,
    renderedScreenshotDataUrl,
  };
  await db.update(runs).set({ result }).where(eq(runs.id, id));

  return c.json({ previewUrl: preview.previewUrl, renderedScreenshotDataUrl });
});

// GET /api/runs — recent runs for the caller.
runsRoute.get("/", async (c) => {
  const userId = getUserId(c);
  const rows = await db
    .select()
    .from(runs)
    .where(eq(runs.userId, userId))
    .orderBy(desc(runs.createdAt))
    .limit(50);
  return c.json(rows);
});
