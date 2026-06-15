import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { projects, runs } from "../db/schema";
import { requireAuth, getUserId } from "../lib/auth";

export const projectsRoute = new Hono();

projectsRoute.use("*", requireAuth());

// GET /api/projects — every project the caller owns, with its latest run's status/progress.
projectsRoute.get("/", async (c) => {
  const userId = getUserId(c);
  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt))
    .limit(100);

  const withRuns = await Promise.all(
    projectRows.map(async (p) => {
      const [latest] = await db
        .select()
        .from(runs)
        .where(eq(runs.projectId, p.id))
        .orderBy(desc(runs.createdAt))
        .limit(1);
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        createdAt: p.createdAt,
        latestRun: latest
          ? {
              id: latest.id,
              status: latest.status,
              progress: latest.progress,
              // Real accuracy comes from a pixel-diff comparator (Phase 5).
              // For now, surface "succeeded" as a placeholder so the UI has
              // something to show; null when no result exists.
              accuracy: latest.result ? null : null,
              pages: latest.result?.routes.length ?? null,
              components: latest.result?.components.length ?? null,
            }
          : null,
      };
    })
  );

  return c.json(withRuns);
});
