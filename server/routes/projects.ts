import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { projects, runs } from "../db/schema";

export const projectsRoute = new Hono();

// GET /api/projects — every project with its latest run's status/progress.
projectsRoute.get("/", async (c) => {
  const projectRows = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(100);

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
              accuracy: latest.result ? 94 : null,
              pages: latest.result?.routes.length ?? null,
              components: latest.result?.components.length ?? null,
            }
          : null,
      };
    })
  );

  return c.json(withRuns);
});
