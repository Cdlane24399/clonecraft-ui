// scripts/db-migrate.ts
//
// Apply SQL files in server/db/migrations to the DIRECT (non-pooled)
// connection. Splits each file on the `--> statement-breakpoint` marker
// that drizzle-kit emits.
//
// Tracks applied migrations in `__drizzle_migrations` (the same table
// drizzle-kit uses). Skips files already recorded there, so re-runs
// are safe.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const MIGRATION_TABLE = "__drizzle_migrations";

async function ensureTable(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(MIGRATION_TABLE)} (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `;
}

async function appliedHashes(sql: ReturnType<typeof postgres>): Promise<Set<string>> {
  const rows = await sql<{ hash: string }[]>`SELECT hash FROM ${sql(MIGRATION_TABLE)}`;
  return new Set(rows.map((r) => r.hash));
}

function hash(content: string): string {
  // 16-char SHA-256 prefix. Stable across machines; collisions are
  // not a concern at 16 hex chars (~64 bits) for a single-developer
  // project with <10k migrations.
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error("DIRECT_URL is not set");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await ensureTable(sql);
    const applied = await appliedHashes(sql);

    const dir = join(process.cwd(), "server/db/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    if (files.length === 0) {
      console.log("No migrations to apply.");
      return;
    }

    let appliedCount = 0;
    let skippedCount = 0;
    for (const f of files) {
      const body = readFileSync(join(dir, f), "utf8");
      const fileHash = hash(body);
      console.log(`  ${f} hash=${fileHash} applied=${applied.has(fileHash)}`);
      if (applied.has(fileHash)) {
        skippedCount++;
        continue;
      }

      const statements = body
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      console.log(`→ ${f} (${statements.length} statement${statements.length === 1 ? "" : "s"})`);
      // Drizzle migrations are not transactional across the whole file
      // by default; we wrap each file in a BEGIN/COMMIT so a partial
      // failure leaves the DB in a clean state.
      await sql`BEGIN`;
      try {
        for (const stmt of statements) {
          await sql.unsafe(stmt);
        }
        await sql`INSERT INTO ${sql(MIGRATION_TABLE)} (hash, created_at) VALUES (${fileHash}, ${Date.now()})`;
        await sql`COMMIT`;
        appliedCount++;
      } catch (err) {
        await sql`ROLLBACK`;
        throw err;
      }
    }

    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log(
      `Applied ${appliedCount} migration(s), skipped ${skippedCount} already-applied.`,
    );
    console.log("Tables in public schema:", tables.map((t) => t.tablename).join(", "));
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
