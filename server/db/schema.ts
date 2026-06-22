import { pgTable, text, integer, timestamp, jsonb, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createId } from "./id";

// ─────────────────────────────────────────────────────────────────────────────
// Users — profile cache for Clerk. Authoritative identity lives in Clerk;
// we keep a row here for FK targets, fast lookups, and the consent record.
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  // Clerk user id (e.g. "user_2a…").
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Projects — one row per (user, website) the user has cloned.
// ─────────────────────────────────────────────────────────────────────────────
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("prj")),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("projects_user_idx").on(t.userId),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Runs — a single clone run against a URL with a chosen config.
// ─────────────────────────────────────────────────────────────────────────────
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey().$defaultFn(() => createId("run")),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
    userIdx: index("runs_user_idx").on(t.userId),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Consent — per-user, per-policy-version acceptance. One row per (userId, kind).
// Written on first ToS / AUP / Privacy click-through. Read at request time to
// gate sensitive actions (e.g. starting a run).
// ─────────────────────────────────────────────────────────────────────────────
export const consentAcceptance = pgTable(
  "consent_acceptance",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // "tos" | "privacy" | "aup"
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.kind] }),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Abuse reports — submitted via POST /api/abuse (public, may be anonymous).
// Used for legal review (DMCA, AUP violations) and to seed any future
// automated takedown logic. We never delete these; PII is minimized to
// reporter email + a single IP address string.
// ─────────────────────────────────────────────────────────────────────────────
export const abuseReports = pgTable("abuse_reports", {
  id: text("id").primaryKey().$defaultFn(() => createId("abr")),
  // Null if the reporter wasn't signed in.
  reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
  reporterEmail: text("reporter_email"),
  category: text("category").$type<AbuseCategory>().notNull(),
  // The URL or run-id the report refers to. Free-text within length limits.
  target: text("target").notNull(),
  details: text("details"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  // Lifecycle: open → triaged → actioned (or dismissed).
  status: text("status").$type<"open" | "triaged" | "actioned" | "dismissed">()
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type AbuseCategory =
  | "copyright"
  | "trademark"
  | "phishing"
  | "malware"
  | "harassment"
  | "illegal-content"
  | "other";

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

/**
 * Ground-truth design data extracted from the live page's *computed styles*
 * (not inferred from a screenshot). Produced by server/lib/extract.ts and fed
 * verbatim into the codegen prompt so the model matches real values instead of
 * guessing them from a picture.
 */
export type ExtractedDesign = {
  /** Dominant colors ranked by painted area, tagged with the role they play. */
  palette: { hex: string; role: "background" | "text" | "border" | "accent" | "surface"; usage: number }[];
  typography: {
    /** Font families ranked by painted area, classified by role. */
    families: { name: string; role: "heading" | "body" | "mono" | "other"; usage: number }[];
    /** The real type scale (distinct font-sizes in px, ascending). */
    sizesPx: number[];
    /** Distinct font-weights actually used. */
    weights: number[];
    lineHeights: string[];
    letterSpacings: string[];
  };
  /** Inferred spacing scale (distinct padding/margin/gap values in px, ascending). */
  spacingScalePx: number[];
  /** Distinct border-radius values in px, ascending. */
  radiiPx: number[];
  /** Distinct box-shadow values, most common first. */
  shadows: string[];
  /**
   * Full-bleed background gradients read from computed `background-image`
   * (linear/radial/conic), dominant first. Computed-style extraction is blind to
   * solid `background-color` only, so without this the palette comes back
   * misleadingly neutral on pages whose color lives in gradients/shaders.
   */
  gradients: { css: string; colors: string[]; usage: number }[];
  /**
   * Count of large `<canvas>` elements detected (likely WebGL/shader
   * backgrounds). A non-zero value tells codegen to approximate an animated
   * shader bg with a layered CSS gradient using the palette/gradient colors.
   */
  shaderCanvases: number;
  /**
   * True when a full-bleed background animates — a large element carrying a
   * gradient/canvas background that also has a CSS animation (or a shader
   * canvas, which is animated by nature). Tells codegen to reproduce the
   * background with a CSS keyframe animation rather than a static gradient.
   */
  animatedBackground?: boolean;
  /**
   * True when a gradient is clipped to animated text (the rainbow hero-headline
   * "sweep" effect). Tells codegen to reproduce the headline with an animated
   * `background-clip: text` gradient rather than flat text.
   */
  animatedGradientText?: boolean;
  /** Sampled button styles (computed) — bg, color, padding, radius, weight, border. */
  buttons: Record<string, string>[];
  layout: { maxContentWidthPx: number | null; sectionCount: number; viewportWidthPx: number };
  /** Top-level page sections in document order, with their real backgrounds/text. */
  sections: { tag: string; label: string; heightPx: number; background: string; textColor: string; fontSizesPx: number[] }[];
  /** Webfont families the page actually loaded (document.fonts). */
  loadedFonts: string[];
};

/** A single concrete visual discrepancy the vision judge found between original and clone. */
export type VisualDifference = {
  /** Where on the page — e.g. "hero", "navbar", "pricing cards", "footer". */
  area: string;
  /** Concrete, actionable description of what's wrong in the clone. */
  issue: string;
  severity: "high" | "medium" | "low";
};

/** Result of comparing the rendered clone against the original screenshot. */
export type FidelityReport = {
  /** Fraction of pixels that differ after normalization (0..1). */
  pixelMismatch: number;
  /** 0..100 fidelity score (100 = pixel-identical, derived from pixelMismatch). */
  score: number;
  /** Ranked visual differences from the vision judge. */
  differences: VisualDifference[];
  /** How many fidelity-fix passes were applied to reach this state. */
  passes: number;
  /** Diff visualization highlighting changed pixels (data URL). */
  diffImageDataUrl?: string;
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
  /** Ground-truth design data extracted from the live page's computed styles. */
  extracted?: ExtractedDesign;
  components: DetectedComponent[];
  files: GeneratedFile[];
  build: BuildReport;
  /** How many fix passes were needed to get a clean build. */
  fixAttempts?: number;
  /** Visual-fidelity comparison of the rendered clone against the original. */
  fidelity?: FidelityReport;
  /** Screenshot of the original captured page (data URL). */
  screenshotDataUrl?: string;
  /** Screenshot of the generated clone running in the e2b sandbox (data URL). */
  renderedScreenshotDataUrl?: string;
  /** Live, interactive preview URL of the running clone (expires with the sandbox). */
  previewUrl?: string | null;
  /** The e2b sandbox id backing the preview, if still alive. */
  sandboxId?: string | null;
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type Project = typeof projects.$inferSelect;
