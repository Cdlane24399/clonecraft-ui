# CloneCraft

> Turn any website into an editable React codebase.

CloneCraft is a multi-agent pipeline that captures a webpage, extracts the design system, and generates an editable React + Tailwind project that runs in a live sandbox. The frontend is a Vite/React/shadcn app; the backend is a Hono server that orchestrates Firecrawl, Claude (via the Vercel AI Gateway), Browserless Chromium, and an e2b sandbox.

## Project layout

```
src/                  React + shadcn frontend (Vite, react-router, react-query)
  pages/              Top-level routes (Landing, NewClone, Progress, Results, ...)
  components/         Shared UI (AppShell, NavLink, BrandLogo, HeroRemotionPlayer)
  components/ui/      shadcn primitives (do not edit by hand; regenerate via shadcn CLI)
  hooks/              React hooks
  lib/                API client + utilities
  test/               Vitest setup + tests
server/               Hono backend (Node, port 8787 in dev)
  index.ts            App entry, route mounting, /api/health
  env.ts              Zod-validated environment config
  routes/             Hono routers (runs, projects, …)
  pipeline/           The clone pipeline (capture → analyze → generate → build → preview)
  lib/                Integrations (firecrawl, browser, sandbox, ai, redis)
  db/                 Drizzle schema, migrations, client
```

## Local development

```bash
npm install
cp .env.example .env        # then fill in real values; .env is git-ignored
npm run dev                  # runs Vite (port 8080) and Hono (port 8787) in parallel
```

The Vite dev server proxies `/api/*` to Hono, so the browser always talks to `:8080`.

### Required services

The `.env.example` documents every variable. To get end-to-end working locally you need:

| Service | Used for | How to provision |
| --- | --- | --- |
| Neon (or any Postgres) | Drizzle ORM | `neonctl projects create` or use the dashboard |
| Upstash Redis | Live run state | upstash.com → REST URL + token |
| Vercel AI Gateway | Claude access | vercel.com → AI Gateway → API key (or `vercel env pull` for OIDC) |
| Firecrawl | Page capture + design system | firecrawl.dev → API key |
| Browserless | Headless Chromium for screenshots | browserless.io → API key |
| e2b | Live preview sandbox | e2b.dev → API key |
| Clerk | Auth (Phase 1+) | dashboard.clerk.com → publishable + secret keys |

## Tests

```bash
npm test                     # one-shot
npm run test:watch           # watch mode
```

Vitest with jsdom. Tests live next to the code in `__tests__` blocks or `*.test.ts(x)` files (see `src/test/example.test.ts`).

## Build

```bash
npm run build                # Vite production build → dist/
npm run build:dev            # Vite dev-mode build (for debugging prod issues)
```

## Database

Drizzle schema lives in `server/db/schema.ts`. Generate + run migrations:

```bash
npm run db:generate          # emit a new SQL migration from schema changes
npm run db:push              # push the schema directly (dev only — no migration history)
npx tsx scripts/db-migrate.ts   # apply committed migrations via the DIRECT_URL connection
npx tsx scripts/db-reset-dev.ts # dev-only: TRUNCATE projects + runs (does NOT touch users)
```

In production, migrations are applied by CI on every merge to `main`. `DIRECT_URL` is the non-pooled connection that migrations use; `DATABASE_URL` is the pooled connection for the live API.

## Auth (Clerk)

All `/api/*` routes except `/api/health` and the webhook endpoints are gated by Clerk session tokens. The middleware lives in `server/lib/clerk.ts` and is hand-rolled on top of `@clerk/backend`'s `authenticateRequest()` (we don't use the deprecated `@hono/clerk-auth` package because its `c.env` lookup is incompatible with `@hono/node-server`).

The authed state lives in a Hono context variable:

```ts
import { readUserId, requireAuth, getUserId } from "./lib/auth";

app.use("/api/protected/*", requireAuth());
app.post("/api/protected/thing", (c) => {
  const userId = getUserId(c);   // throws 401 if unauthenticated
  // ...use userId to scope all DB writes...
});
```

On the frontend, `<ClerkProvider>` is mounted in `src/main.tsx`. Public routes (`/`, `/sign-in`, `/sign-up`) and the `/app/*` gated subtree are wired in `src/App.tsx`. `src/components/RequireAuth.tsx` is the gate that prompts the user to sign in.

Required env vars: `VITE_CLERK_PUBLISHABLE_KEY` (frontend) and `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (server). `scripts/setup-env.sh` mirrors the publishable key to both names so the server can read it.

## Deploy

(Will be filled in as part of Phase 6.) Frontend → Vercel. Backend → Fly.io. Postgres → Neon. Redis → Upstash. Sandboxes → e2b.

## License

Private. All rights reserved.
