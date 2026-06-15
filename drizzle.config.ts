import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations run over the DIRECT (non-pooled) connection.
export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
