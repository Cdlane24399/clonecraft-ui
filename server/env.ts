import { config } from "dotenv";
import { z } from "zod";

// Load .env first, then .env.local (where `vercel env pull` writes the
// short-lived VERCEL_OIDC_TOKEN); .local overrides.
config({ path: ".env" });
config({ path: ".env.local", override: true });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Vercel AI Gateway. Auth resolves to AI_GATEWAY_API_KEY, then VERCEL_OIDC_TOKEN.
  AI_GATEWAY_API_KEY: z.string().optional(),
  VERCEL_OIDC_TOKEN: z.string().optional(),
  GATEWAY_CODEGEN_MODEL: z.string().default("anthropic/claude-opus-4.8"),
  GATEWAY_VISION_MODEL: z.string().default("anthropic/claude-sonnet-4.6"),

  BROWSERLESS_API_KEY: z.string().min(1),
  BROWSERLESS_WS_URL: z.string().default("wss://production-sfo.browserless.io"),
  CRAWL_MAX_PAGES: z.coerce.number().default(200),
  CRAWL_NAV_TIMEOUT_MS: z.coerce.number().default(30000),

  // Firecrawl — rich source capture (screenshot + branding/design-system + links).
  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_API_URL: z.string().default("https://api.firecrawl.dev/v2"),

  E2B_API_KEY: z.string().optional(),
  E2B_TEMPLATE: z.string().default("base"),
  // How long to keep a preview sandbox alive so the user can interact with the clone.
  PREVIEW_TIMEOUT_MS: z.coerce.number().default(15 * 60 * 1000),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.string().default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (!env.AI_GATEWAY_API_KEY && !env.VERCEL_OIDC_TOKEN) {
  console.warn(
    "⚠️  No AI Gateway auth found. Set AI_GATEWAY_API_KEY or run `vercel env pull .env.local` for an OIDC token."
  );
}
