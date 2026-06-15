// scripts/db-migrate.ts
//
// Apply all SQL files in server/db/migrations to the DIRECT (non-pooled)
// connection. Splits each file on the `--> statement-breakpoint` marker
// that drizzle-kit emits.
//
// Idempotent? No — Drizzle migrations don't use IF NOT EXISTS by default.
// Re-running will fail. Use `drizzle-kit push` for the dev inner loop.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error("DIRECT_URL is not set");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const dir = join(process.cwd(), "server/db/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    if (files.length === 0) {
      console.log("No migrations to apply.");
      return;
    }

    for (const f of files) {
      const body = readFileSync(join(dir, f), "utf8");
      const statements = body
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      console.log(`→ ${f} (${statements.length} statement${statements.length === 1 ? "" : "s"})`);
      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }
    }

    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log("Tables in public schema:", tables.map((t) => t.tablename).join(", "));
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
