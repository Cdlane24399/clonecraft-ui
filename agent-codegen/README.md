# clonecraft-codegen-agent

An [eve](https://github.com/vercel/eve) agent that owns CloneCraft's
**generate → build → fix → preview** loop. It runs as its own HTTP service; the
main app's Hono pipeline calls it over HTTP.

## Why a separate package?

eve's peer dependencies (`ai@7-beta`, `react@^19`, `vite@^8`, Node ≥24) conflict
with the main app (`ai@6`, React 18, Vite 5). Keeping the agent in its own
package with its own `node_modules` lets us adopt eve **without** upgrading the
working app. This is also eve's intended deployment shape — the agent is a
standalone service reachable over the stable `/eve/v1/session` HTTP API.

The main app talks to it with plain `fetch` (`server/lib/codegenAgent.ts`), so
it never imports `eve` and its dependency tree stays untouched.

## What it does

The pipeline hands the agent an initial set of generated project files. The
agent drives a model-driven loop with one tool, `build_preview`:

1. `build_preview` bundles the current files with esbuild in an **e2b** sandbox.
2. On failure it returns the esbuild errors; the model fixes the files and calls
   again. One sandbox is reused across passes, so deps install only once.
3. On success it serves a live preview and returns the public URL.

The agent returns a structured result (`{ files, build, previewUrl, sandboxId,
fixAttempts }`) that the pipeline persists and screenshots — exactly the shape
the old in-process loop produced.

This replaces the app's bounded 2-pass `while` loop with a durable, resumable,
unbounded agentic loop.

## Layout

```
agent/
  agent.ts              model + task-mode output schema
  instructions.md       the build→fix→preview procedure + code constraints
  tools/build_preview.ts  esbuild + serve in e2b (authored tool, app runtime)
  lib/preview.ts        ported e2b PreviewSession + per-session sandbox cache
  lib/types.ts          GeneratedFile / BuildReport (mirror server/db/schema.ts)
```

## Run it

```bash
cp .env.example .env     # fill in AI_GATEWAY_API_KEY (or pull an OIDC token) + E2B_API_KEY
npm install
npm run dev              # eve dev — serves http://127.0.0.1:3000
```

Then point the main app at it by setting in the app's `.env`:

```
CODEGEN_AGENT_URL=http://127.0.0.1:3000
```

Or run all three processes (web + api + agent) from the app root:

```bash
npm run dev:all
```

Without `CODEGEN_AGENT_URL`, the pipeline silently uses its in-process fallback
loop, so the app works with or without this service running.

## Notes

- **Auth:** the default eve channel auth (`localDev()`) accepts loopback only, so
  local server-to-server works out of the box. For a non-loopback deployment,
  add `agent/channels/eve.ts` with real auth and set `CODEGEN_AGENT_TOKEN` in the
  app (sent as a bearer).
- **Vision codegen stays in the app.** The initial screenshot→code generation
  (a vision model call) remains in `server/pipeline/run.ts`; this agent owns the
  build/fix/preview loop. Moving initial generation here is a possible follow-up
  (it would need image input on the session message).
- **Visual-fidelity refinement also stays in the app.** This agent returns its
  `sandboxId`; the app reconnects to that sandbox
  (`PreviewSession.reconnect`) and runs the judge→fix→rebuild fidelity loop in
  place — so enabling the agent does **not** disable refinement. The agent's
  sandbox layout is identical to the app's (same `APP_ROOT`, port, and
  `public/bundle.js`), which is what makes the reconnect-and-rebuild work.
- `lib/types.ts` mirrors `server/db/schema.ts` — keep the two in sync.
```
