import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "./id";

// A clone target — one row per website the user has cloned.
export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => createId("prj")),
  name: text("name").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A single clone run against a URL with a chosen config.
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("run")),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // { depth, stack, goal, opts }
    config: jsonb("config").$type<RunConfig>().notNull(),
    status: text("status").$type<RunStatus>().notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    currentStage: text("current_stage"),
    error: text("error"),
    // Final structured result (analysis + generated code + build report).
    result: jsonb("result").$type<RunResult>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    projectIdx: index("runs_project_idx").on(t.projectId),
  })
);

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type RunConfig = {
  depth: "landing" | "top5" | "full";
  stack: "react" | "next" | "html";
  goal: "recreate" | "redesign" | "rebrand" | "saas";
  opts: Record<string, boolean>;
};

export type DesignTokens = {
  colors: { name: string; value: string }[];
  fonts: string[];
  radii?: string[];
  spacingBase?: string;
  buttons?: { primary?: Record<string, string>; secondary?: Record<string, string> };
};

export type DetectedComponent = { name: string; count: number; confidence: number };

export type GeneratedFile = { path: string; content: string };

export type BuildReport = {
  ran: boolean;
  passed: boolean;
  output: string;
};

export type RunResult = {
  title: string;
  summary: string;
  routes: string[];
  tokens: DesignTokens;
  components: DetectedComponent[];
  files: GeneratedFile[];
  build: BuildReport;
  /** How many fix passes were needed to get a clean build. */
  fixAttempts?: number;
  /** Screenshot of the original captured page (data URL). */
  screenshotDataUrl?: string;
  /** Screenshot of the generated clone running in the e2b sandbox (data URL). */
  renderedScreenshotDataUrl?: string;
  /** Live, interactive preview URL of the running clone (expires with the sandbox). */
  previewUrl?: string | null;
  /** The e2b sandbox id backing the preview, if still alive. */
  sandboxId?: string | null;
};

export type Run = typeof runs.$inferSelect;
export type Project = typeof projects.$inferSelect;
