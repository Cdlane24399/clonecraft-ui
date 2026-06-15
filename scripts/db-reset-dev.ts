// scripts/db-reset-dev.ts
//
// One-shot helper: drop all rows from the projects + runs tables so a
// not-null user_id column can be added without violating the constraint.
// Safe to re-run; it just becomes a no-op once the rows are gone.
//
// Usage:  npx tsx scripts/db-reset-dev.ts
//
// Does NOT touch the `users` table — Clerk is the source of truth for
// identity, so user rows should only be added via the auth flow.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import postgres from "postgres";
import { env } from "../server/env";

async function main() {
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  try {
    const before = await sql<{ table_name: string; n: number }[]>`
      SELECT 'projects' as table_name, count(*)::int as n FROM projects
      UNION ALL
      SELECT 'runs' as table_name, count(*)::int as n FROM runs
    `;
    console.log("Before:");
    for (const r of before) console.log(`  ${r.table_name.padEnd(10)} ${r.n} rows`);

    // Order matters: runs references projects; delete children first.
    await sql`TRUNCATE TABLE runs, projects RESTART IDENTITY CASCADE`;
    console.log("Truncated runs, projects.");

    const after = await sql<{ table_name: string; n: number }[]>`
      SELECT 'projects' as table_name, count(*)::int as n FROM projects
      UNION ALL
      SELECT 'runs' as table_name, count(*)::int as n FROM runs
    `;
    console.log("After:");
    for (const r of after) console.log(`  ${r.table_name.padEnd(10)} ${r.n} rows`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("reset failed:", err);
  process.exit(1);
});
