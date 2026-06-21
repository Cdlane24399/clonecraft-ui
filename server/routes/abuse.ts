import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { readUserId } from "../lib/clerk";

/**
 * Public abuse-report endpoint. Accepts reports from any caller (signed
 * in or not) so a victim doesn't need an account to flag something. The
 * report is written to the abuse_reports table for human review; an email
 * is sent to abuse@<our domain> via Resend (when configured).
 *
 * In Phase 6 we'll wire Resend. For Phase 2 the email send is a no-op
 * and reports are persisted only.
 */
export const abuseRoute = new Hono();

const reportSchema = z.object({
  // What they're reporting.
  category: z.enum([
    "copyright",
    "trademark",
    "phishing",
    "malware",
    "harassment",
    "illegal-content",
    "other",
  ]),
  // The URL or run-id at issue.
  target: z.string().min(1).max(2048),
  // Free-text details (max 4 KB; not a place for essays).
  details: z.string().max(4096).optional(),
  // Reporter's email (so we can follow up). Optional.
  email: z.string().email().optional(),
});

abuseRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid report", details: parsed.error.flatten() }, 400);
  }
  const { category, target, details, email } = parsed.data;
  const reporterId = readUserId(c); // null if anon — that's fine

  // Capture some forensic context that doesn't require consent.
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    c.req.header("x-real-ip") ??
    null;
  const userAgent = c.req.header("user-agent") ?? null;

  // Lookup reporter's email if they're signed in.
  let reporterEmail: string | null = email ?? null;
  if (reporterId && !reporterEmail) {
    const [u] = await db.select().from(users).where(eq(users.id, reporterId));
    reporterEmail = u?.email ?? null;
  }

  // Persist. In Phase 6 we'll also send to Resend; for now, the console
  // log is the only signal (and the DB row is the durable record).
  const { abuseReports } = await import("../db/schema");
  const [row] = await db
    .insert(abuseReports)
    .values({
      reporterId: reporterId,
      reporterEmail,
      category,
      target,
      details: details ?? null,
      ip,
      userAgent,
    })
    .returning();
  console.log(
    `[abuse] new report id=${row.id} category=${category} target=${target.slice(0, 80)}` +
      (reporterId ? ` reporter=${reporterId}` : " (anonymous)"),
  );

  return c.json({ ok: true, id: row.id }, 201);
});
