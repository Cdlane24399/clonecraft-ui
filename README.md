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
```

In production, migrations are applied by CI on every merge to `main`. `DIRECT_URL` is the non-pooled connection that migrations use; `DATABASE_URL` is the pooled connection for the live API.

## Deploy

(Will be filled in as part of Phase 6.) Frontend → Vercel. Backend → Fly.io. Postgres → Neon. Redis → Upstash. Sandboxes → e2b.

## License

Private. All rights reserved.
