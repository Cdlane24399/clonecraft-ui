# CloneCraft — Fidelity & Performance Uplift Plan

> **Status:** Ready for execution
> **Author:** review of CloneCraft vs. `ericshang98/Perfect-Web-Clone`
> **Goal:** maximum clone fidelity + maximum performance/cost-efficiency
> **Execution model:** phased, subagent-friendly. Each task is self-contained — it
> names the files, the change, and how to verify it. Do phases in order; within a
> phase, tasks are mostly independent and can be parallelized across agents.

---

## 0. Background & rationale

CloneCraft turns any URL into an editable React codebase. Pipeline today
([server/pipeline/run.ts](../../server/pipeline/run.ts)):

```
capture (Firecrawl → re-screenshot → computed-style extract)
  → vision analysis (generateObject)
  → SINGLE-PASS generateCode (streamText, maxOutputTokens: 32000)
  → E2B sandbox: esbuild --bundle  (+ ≤2 whole-file fix passes)
  → screenshot clone → pixel diff + vision-judge fidelity loop (≤2 passes, in-process path only)
  → persist; frontend POLLS run state every 1s
```

We benchmarked it against **Perfect-Web-Clone** (Next.js + Python/FastAPI + Playwright +
orchestrator/worker multi-agent codegen on Claude). Its fidelity edge comes from three
things, all of which target current CloneCraft weaknesses:

1. **Chunked parallel section codegen** — a rule-based chunker splits the page into
   non-overlapping, gap-free sections each `< 10k tokens`, then runs one Claude worker
   **per section in parallel**, each owning its own namespace dir (zero write conflicts).
   The orchestrator alone assembles `App.tsx`.
   → CloneCraft does a **single** `streamText` capped at `maxOutputTokens: 32000`
   ([ai.ts:44](../../server/lib/ai.ts)). Large pages **truncate silently**: the regex parser
   ([codegenFiles.ts:10](../../server/lib/codegenFiles.ts)) drops the unterminated block, and the
   fallback dumps everything into one `App.tsx` ([run.ts:251](../../server/pipeline/run.ts)).
   **This is the hard ceiling on fidelity.**

2. **Verbatim "HTML→JSX CONVERTER, not a content creator" framing** with explicit ❌/✅
   rules (keep all text/URLs exact, no Lorem ipsum). Cheap, high-leverage. CloneCraft's
   prompt says "treat the spec as ground truth" but never forbids paraphrasing.

3. **Error-driven self-correction that blocks completion** — merges terminal + browser
   (console/overlay) + static-import errors and **refuses to finish while any error
   exists**. CloneCraft only checks the esbuild **bundle exit code**
   ([sandbox.ts](../../server/lib/sandbox.ts)) — no typecheck, no runtime/console check — so
   "build passed" can't catch a blank render or runtime throw. Its fidelity gate is the
   *pixel score* but the loop only acts on the *vision judge*; the two signals are never
   reconciled, and it caps at 2 passes on the in-process path only.

**Cost facts that shape Phase 1:**

- Codegen + vision both go through the **Vercel AI Gateway** via the `ai` SDK
  (`generateObject` / `streamText`), models = `anthropic/claude-opus-4.8` (codegen) and
  `anthropic/claude-sonnet-4.6` (vision) ([ai.ts:8-11](../../server/lib/ai.ts)).
- **No prompt caching anywhere.** The large static system prompt + the (large) design
  spec + full-resolution screenshots are re-sent uncached on every generate/fix/fidelity
  call.
- **Full-resolution PNG screenshots** are sent to vision, judge, and every fix pass.
  Perfect-Web-Clone compresses inspection screenshots to ≤50KB JPEG; CloneCraft does not.
- **Every fix re-emits ALL files** ([ai.ts:104](../../server/lib/ai.ts), [ai.ts:148](../../server/lib/ai.ts)) —
  token-bound and prone to dropping files between passes.

### What we are explicitly NOT adopting

- Their stack (Next.js + Python + WebContainer/"BoxLite"). Vite+Hono+E2B is cleaner and
  **more secure** — their "BoxLite" is an unsandboxed local subprocess (`shell()` = host
  RCE). Keep E2B.
- Their `max_iterations=999999` runaway loops. Keep hard caps.
- Replay player / 3D landing page (polish, not fidelity).

---

## 1. Guiding principles

- **Surgical edits.** Keep changes near sensitive config (auth, CSP, E2B keys) minimal.
- **Backwards compatible.** The single-pass path stays as a fallback behind a flag until
  the chunked path is proven.
- **Verify each phase by running a real clone**, not just unit tests. Use a small page
  (e.g. a simple landing) and a large page (truncation repro) as fixtures.
- **Measure before/after**: tokens per run, wall-clock per stage, final fidelity score.

---

## Phase 1 — Quick wins: cost reduction + cheap fidelity (do first)

Small, low-risk, high-ROI. No architectural change. Target: cut tokens/cost per run
substantially and lift fidelity floor before the big refactor.

### Task 1.1 — Prompt caching on the static system prompt + design spec
**Files:** [server/lib/ai.ts](../../server/lib/ai.ts), callers in
[server/pipeline/run.ts](../../server/pipeline/run.ts), [server/lib/fidelity.ts](../../server/lib/fidelity.ts).

**Why:** `CODEGEN_SYSTEM` (~1.5k tokens) + `designSpec` (can be multiple k tokens) are
identical across the generate call and every fix/fidelity call in a run. Caching them
turns repeated input into cache reads (~10% cost, faster TTFT).

**How:** the `ai` SDK exposes Anthropic prompt caching via `providerOptions`. Mark the
system prompt and the design-spec text part as ephemeral cache breakpoints:

```ts
// on the message content part (text) that should be cached:
{ type: "text", text: designSpec,
  providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
// and/or system as a cached message part
```

**Caveats to resolve during execution (do not skip):**
- Confirm the **Vercel AI Gateway passes `providerOptions.anthropic` through** to
  Anthropic. If the gateway strips provider metadata, fall back to calling the Anthropic
  provider directly for codegen (the `@anthropic-ai/sdk` is already a dependency) or use
  the gateway's documented cache mechanism. **Verify with a token-usage check**, don't
  assume.
- Cache breakpoints have a 5-minute TTL and a minimum cacheable size — only cache the
  large, stable parts (system prompt, design spec, the screenshot), not the per-call
  delta (errors, diffs).

**Verify:** run one clone with logging of `usage` (cache-creation vs cache-read tokens);
confirm fix passes show cache reads. Expect a clear drop in input tokens on passes 2+.

### Task 1.2 — Cache the screenshot image part across passes
**Files:** [server/lib/ai.ts](../../server/lib/ai.ts).

**Why:** the original screenshot is re-sent (full-res) to vision, judge, generate, and
every fidelity fix. It's the single biggest token chunk and it never changes within a run.

**How:** mark the image content part with the same `cacheControl: ephemeral`. Combined
with 1.1, the entire stable prefix (system + screenshot + spec) becomes one cached block.

**Verify:** usage logging shows the image tokens as cache reads on passes 2+.

### Task 1.3 — Compress inspection screenshots
**Files:** [server/lib/browser.ts](../../server/lib/browser.ts) (screenshot helpers),
[server/lib/ai.ts](../../server/lib/ai.ts) (callers).

**Why:** full-resolution PNGs at 1440×900 are large. Perfect-Web-Clone caps inspection
shots at ≤50KB JPEG and still converges. Vision/judge don't need pixel-perfect input.

**How:** add a `compressForVision(base64png)` that downscales to ≤~1024px wide and
re-encodes JPEG q~60 (reuse `pngjs`/`sharp` if present, else a lightweight encoder).
Use it for the **vision-analysis**, **judge**, and **fix** image parts.
**Keep the full-res PNG for the pixel diff** ([visualDiff.ts](../../server/lib/visualDiff.ts)) — that
needs real pixels.

**Verify:** fidelity score on a known page is within ~2 points of before; vision-call
input tokens drop materially.

### Task 1.4 — Reframe codegen prompt as verbatim conversion
**Files:** [server/pipeline/run.ts](../../server/pipeline/run.ts) `CODEGEN_SYSTEM` (lines 98-117).

**Why:** highest-leverage fidelity change that costs almost nothing. Suppresses the
model's urge to paraphrase copy, swap URLs, or "improve" the design.

**How:** add an explicit conversion contract to the system prompt, e.g.:
- "You are converting a real, measured page into JSX. You are a CONVERTER, not a content
  creator."
- ✅ Reproduce **all visible text word-for-word**. ✅ Keep every URL/href exactly.
  ✅ `class` → `className`.
- ❌ No Lorem ipsum. ❌ No `example.com`. ❌ Do not summarize, shorten, or invent copy.
- Keep the existing z-index / gradient / lucide rules.

Feed the captured **page text** (`capture.text`) into the codegen prompt as the
source-of-truth copy (today only 4k chars go to *vision*, not to *codegen*).

**Verify:** clone a text-heavy page; confirm headings/paragraph copy match the original
verbatim rather than being paraphrased.

### Task 1.5 — Image proxy so cloned images render in preview
**Files:** [server/lib/sandbox.ts](../../server/lib/sandbox.ts) (the served `index.html` / static
server), [agent-codegen/agent/lib/preview.ts](../../agent-codegen/agent/lib/preview.ts) (mirror).

**Why:** the current prompt forbids importing external images (uses inline SVG/CSS) to
dodge CORS, which loses real imagery and corrupts the pixel diff. Perfect-Web-Clone
injects a `/proxy-image?url=` server middleware so real images render.

**How:** add a tiny proxy endpoint to the preview server that fetches an external image
server-side and streams it back with permissive CORS. Then relax the prompt to allow
`<img src="/proxy-image?url=...">` for real assets. Keep inline-SVG fallback for brand
marks.

**Verify:** clone a page with hero imagery; confirm images appear in the rendered
screenshot and the fidelity score rises.

### Task 1.6 — Truncation guardrail (stopgap until Phase 2)
**Files:** [server/lib/codegenFiles.ts](../../server/lib/codegenFiles.ts),
[server/pipeline/run.ts](../../server/pipeline/run.ts).

**Why:** until chunking lands, a 32k-capped single pass can still truncate. Today that
fails silently into one-big-`App.tsx`.

**How:** in `parseGeneratedFiles`, detect a dangling/unterminated fenced block (odd fence
count, or `finishReason === "length"` from `streamText`). When detected, **log a
warning** and trigger a continuation request ("continue the previous file from where you
stopped") rather than silently dropping it.

**Verify:** force a small `maxOutputTokens` on a large page; confirm the warning fires and
files aren't silently merged.

**Phase 1 exit criteria:** measurable token/cost drop per run (caching + compression),
verbatim copy in clones, real images in previews, no silent truncation. Run the
before/after metrics on the two fixtures.

---

## Phase 2 — Chunked + parallel section workers (TOP PRIORITY structural change)

Removes the truncation ceiling, parallelizes the slowest stage, and makes fixes surgical.
This is the core fidelity uplift. Build it behind a feature flag
(`CODEGEN_MODE=chunked|single`) so the single-pass path remains a fallback.

### Task 2.1 — Section chunker
**New file:** `server/lib/chunker.ts`. **Inputs:** the computed-style extraction
([extract.ts](../../server/lib/extract.ts)) already produces `sections` (top-level sections in
document order) — use that as the spine, enriched with the DOM/HTML per section.

**Contract (port the three invariants from `component_analyzer.py`):**
1. Sections are **mutually exclusive** (no overlap).
2. Sections **reassemble into the whole page** (no gaps).
3. Each section is **< ~10k tokens** (estimate `chars/4`); recursively split larger ones
   (cap recursion depth, e.g. 15).

**Output:** `Section[]` where each has `{ id, semanticType, order, html, designSubspec }`.
`semanticType` drives assembly order (header=0 … footer=10). `designSubspec` is the
slice of the global design spec relevant to that section (or just reuse the global spec
in v1 to keep it simple).

**Verify:** unit test the invariants on a captured fixture (no overlap, full coverage,
every chunk under cap). This file should be **pure + unit-tested** like `extract.ts`'s
`aggregateDesignData`.

### Task 2.2 — Per-section worker codegen with namespace isolation
**Files:** [server/lib/ai.ts](../../server/lib/ai.ts) (add `generateSection`),
[server/pipeline/run.ts](../../server/pipeline/run.ts) (orchestration).

**How:**
- Each worker gets: the verbatim-conversion system prompt (Task 1.4), its section HTML,
  its design subspec, and the cropped screenshot region for that section if feasible.
- Each worker **owns `src/components/sections/<id>/`** and writes only there. Forbid it
  from touching `App.tsx` / entry / config. (Port the `task_contract` idea: silently
  relocate stray writes into the namespace, or reject them.)
- Run workers in parallel with a **bounded concurrency semaphore** (e.g. 4–6) — NOT
  unbounded. Per-worker timeout. `continueOnFailure`: a failed section degrades to a
  placeholder rather than failing the whole run.

**Verify:** clone a large page; confirm N sections generate concurrently, each in its own
dir, no write conflicts, total wall-clock < single-pass.

### Task 2.3 — Orchestrator assembly
**Files:** [server/pipeline/run.ts](../../server/pipeline/run.ts).

**How:** after workers finish, the orchestrator generates `src/App.tsx` + `src/main.tsx`
from **what was actually written to disk**, importing each section component and ordering
by `semanticType`. Do not let workers write `App.tsx`.

**Verify:** assembled `App.tsx` imports every successful section in correct visual order;
build passes.

### Task 2.4 — Surgical per-section fixes (replaces whole-file regeneration)
**Files:** [server/lib/ai.ts](../../server/lib/ai.ts) `fixCode` / `fixVisualFidelity`,
[server/lib/fidelity.ts](../../server/lib/fidelity.ts).

**How:** when a build/fidelity error maps to a section (by file path / namespace), re-run
**only that section's worker** with the error + its current files, instead of re-emitting
all files. Falls back to whole-project fix only for cross-cutting errors (entry/config).

**Verify:** induce an error in one section; confirm only that section is regenerated and
token cost per fix drops sharply.

### Task 2.5 — Wire the feature flag + metrics
**Files:** [server/env.ts](../../server/env.ts), [server/pipeline/run.ts](../../server/pipeline/run.ts).

**How:** `CODEGEN_MODE` env (`chunked` default once proven, `single` fallback). Log
per-run: section count, parallel workers, tokens, wall-clock per stage, fidelity score.

**Phase 2 exit criteria:** large pages that previously truncated now produce complete,
multi-file clones; wall-clock for codegen drops via parallelism; fidelity score on
fixtures improves; single-pass fallback still works behind the flag.

---

## Phase 3 — Real-error self-correction gate

Make "done" mean "renders without errors," not "bundle exited 0."

### Task 3.1 — Scrape real runtime/console errors from the served preview
**Files:** [server/lib/browser.ts](../../server/lib/browser.ts) (already connects via
puppeteer-core), new `server/lib/renderErrors.ts`.

**How:** when screenshotting the served preview, also collect: `console` errors,
uncaught `pageerror`, failed network requests, and a **white-screen / empty-root**
heuristic (root has no painted children). Return a structured `RenderError[]`.

**Verify:** a clone that bundles but throws at runtime now reports errors instead of
"passed."

### Task 3.2 — Block completion while errors exist (bounded)
**Files:** [server/pipeline/run.ts](../../server/pipeline/run.ts), [server/lib/fidelity.ts](../../server/lib/fidelity.ts).

**How:** extend the fix loop to consume `RenderError[]` (terminal + runtime + console),
not just the esbuild exit code. Loop fixes (per-section where possible, Task 2.4) until no
errors **or** a hard cap (keep `MAX_FIX_ATTEMPTS`-style bound — do NOT adopt their
999999). Reuse the same E2B session so deps install once.

**Verify:** a runtime-error clone converges to a clean render or exits at the cap with the
errors recorded.

### Task 3.3 — Reconcile pixel + judge signals
**Files:** [server/lib/fidelity.ts](../../server/lib/fidelity.ts), [server/lib/visualDiff.ts](../../server/lib/visualDiff.ts).

**Why:** today the loop *gates* on the pixel score but *acts* on the judge — disconnected.

**How:** define a single fidelity objective: (a) ensure aligned dimensions before
diffing (the top-left crop is a crude proxy — consider resizing both to a common width),
(b) drive the loop on the **judge's ranked issues** and **stop** when both the judge
reports no high-severity issues AND the pixel score clears target. Record both so they
agree on "done."

**Phase 3 exit criteria:** no clone is marked succeeded while it renders blank or throws;
the fidelity loop optimizes the same signal it gates on.

---

## Phase 4 — Optional follow-ups (not required for the fidelity goal)

Lower priority; listed so they aren't lost. Pull into a phase only if needed.

- **Streaming progress (SSE) instead of 1s polling** ([Progress.tsx](../../src/pages/Progress.tsx)
  polls `refetchInterval: 1000`). Reduces latency/load; nice UX, not fidelity.
- **Capture connection reuse / caching.** Capture does 2–3 full headless loads per run
  (Firecrawl + re-screenshot + computed-style extract), each a separate puppeteer
  connect/close. Reuse one browser session; optionally cache captures by URL.
- **Run queue / concurrency control.** `runPipeline` is a detached `void` promise per
  request ([runs.ts:70](../../server/routes/runs.ts)); nothing bounds total in-flight E2B
  sandboxes. Add a queue.
- **Crash recovery / stuck-run reconciliation.** A dead process leaves runs `running`
  forever in Postgres (only Redis has a 1h TTL). Add a reconciler.
- **De-duplicate the two `PreviewSession` implementations**
  ([sandbox.ts](../../server/lib/sandbox.ts) ≈ [agent-codegen/agent/lib/preview.ts](../../agent-codegen/agent/lib/preview.ts))
  — already drifting; share a module.
- **Multi-page cloning.** `depth`/`pickRoutes`/`CRAWL_MAX_PAGES` exist but only `/` is
  ever generated; `routes` is decorative. Either implement or remove the affordance.
- **Honor `stack: next | html`** — today it only changes a prompt label; the sandbox
  always bundles a React SPA.

---

## Sequencing summary

1. **Phase 1** (caching, compression, verbatim prompt, image proxy, truncation guard) —
   immediate cost cut + fidelity floor. Low risk.
2. **Phase 2** (chunker + parallel workers + per-section fixes) — **top priority**;
   removes the truncation ceiling and is the core quality uplift. Behind a flag.
3. **Phase 3** (real-error gate + signal reconciliation) — makes "done" trustworthy.
4. **Phase 4** — opportunistic hardening/scope.

## Test fixtures to keep around

- **Small page** (simple landing) — fast regression + before/after metrics.
- **Large/long page** (the truncation repro) — proves Phase 2 fixes the ceiling.
- **Image-heavy page** — proves Task 1.5.
- **Page with a runtime error pattern** — proves Phase 3.
