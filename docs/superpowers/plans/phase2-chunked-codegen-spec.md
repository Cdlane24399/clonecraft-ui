# Phase 2 — Chunked + Parallel Section Codegen — Design Spec (pre-plan)

> **Status:** NOT YET a step-by-step implementation plan. This is a design spec to
> feed a `superpowers:brainstorming` pass. Phase 2 has real design decisions that
> must be resolved before a concrete TDD plan can be written (writing-plans requires
> complete, grounded code — we won't fabricate code for an unsettled design).
>
> **Predecessor:** Phase 1 is merged to `main` (commit `081b21f`). See
> [2026-06-21-fidelity-phase1.md](2026-06-21-fidelity-phase1.md).
>
> **Source of intent:** Phase 2 of [../plans/fidelity-performance-uplift.md](../../plans/fidelity-performance-uplift.md).

## Goal

Remove the single-pass truncation ceiling and parallelize the slowest stage: split
the page into sections, generate one Claude worker per section in parallel, then have
an orchestrator assemble `App.tsx`. Behind a feature flag (`CODEGEN_MODE=chunked|single`)
so the single-pass path remains a proven fallback.

## Code realities discovered (these shape the design — verify before relying)

1. **Sections carry NO HTML today.** `ExtractedDesign.sections` is
   `{ tag, label, heightPx, background, textColor, fontSizesPx }[]`
   ([server/db/schema.ts:199](../../server/db/schema.ts)), produced by
   `aggregateDesignData` ([server/lib/extract.ts:694](../../server/lib/extract.ts)). There is
   **no per-section DOM/HTML**. The original Phase 2 text assumed sections could be
   "enriched with the DOM/HTML per section" — that data does not exist yet. The full
   page HTML *is* available as `capture.html` and the text as `capture.text`
   ([server/lib/browser.ts:50](../../server/lib/browser.ts) `CaptureResult`).

2. **Workers return in-memory file sets, not files on a shared disk.**
   `GeneratedFile = { path; content }` ([server/db/schema.ts:229](../../server/db/schema.ts)).
   `PreviewSession.build()` does `rm -rf src` then writes the *whole* file set at once
   ([server/lib/sandbox.ts:99](../../server/lib/sandbox.ts)). So the Perfect-Web-Clone
   "each worker owns a namespace dir to avoid write conflicts" framing is mostly moot
   here — there is no concurrent filesystem to conflict on. The real invariant we need
   is: **section workers must produce non-colliding `path`s** (e.g. each owns
   `src/components/sections/<id>/`) and **must not emit `src/App.tsx`** (the orchestrator owns it).

3. **Two codegen paths already exist and must coexist.** The in-process loop and the
   HTTP `codegenAgent` path (`runCodegenAgent`, gated by `codegenAgentAvailable` /
   `CODEGEN_AGENT_URL` — [server/lib/codegenAgent.ts:72](../../server/lib/codegenAgent.ts),
   [server/pipeline/run.ts:290](../../server/pipeline/run.ts)). `CODEGEN_MODE=chunked` must
   slot in cleanly alongside (decide: does chunked mode apply only to the in-process
   path, or also drive the agent? Recommend: in-process only for v1).

4. **No run queue.** `runPipeline` is a detached `void` promise per request
   ([server/routes/runs.ts:70](../../server/routes/runs.ts)). Phase 2 adds *intra-run*
   parallelism (N section workers); it does NOT fix *inter-run* concurrency (that's a
   Phase 4 item). Bound the section-worker concurrency with a semaphore so one run
   can't fan out to dozens of simultaneous gateway calls.

5. **Phase 1 building blocks to reuse:** `buildCachedUserContent` / `EPHEMERAL` caching,
   `compressForVision`, the verbatim `CODEGEN_SYSTEM`, `parseGeneratedFiles`,
   `isLikelyTruncated` + `continueGeneration`. A per-section worker is a smaller
   `generateCode` with a section-scoped prompt — it inherits all of these.

## Design decisions to resolve in brainstorming (with starting recommendations)

- **D1 — Where do section boundaries + per-section content come from?**
  - (a) Extend `extract.ts` to also capture each top-level section's `outerHTML` (richest signal, but grows the extraction payload and the `ExtractedDesign` type / DB schema).
  - (b) A new pure `chunker.ts` parses `capture.html` into top-level sections itself (no schema change; chunker owns the DOM walk). **Recommended for v1** — keeps `extract.ts` untouched and the chunker pure + unit-testable, matching the original doc's "rule-based chunker" intent.
  - (c) No HTML at all: drive each worker from the section's measured metadata (`heightPx`, `background`, `textColor`, `fontSizesPx`), a slice of `capture.text`, and a **cropped screenshot region** for that section. Lowest fidelity for structure; highest for visuals.
  - Likely answer: **(b) + cropped screenshot per section**.

- **D2 — Section schema.** Original doc proposes
  `Section { id, semanticType, order, html, designSubspec }` with `semanticType`
  (header=0 … footer=10) driving assembly order. Decide the `semanticType` taxonomy and
  how it's inferred from `tag`/`label`/position. For v1, `designSubspec` can just reuse
  the global `buildDesignSpec(ex)` output (per the original doc) to keep it simple.

- **D3 — Cropped screenshot per section.** We have a full-page PNG and per-section
  `heightPx`. Cumulative heights → vertical crop offsets → `pngjs` crop (we already crop
  RGBA in [visualDiff.ts:34](../../server/lib/visualDiff.ts) `cropRGBA`). Feasible and
  pure-testable. Decide whether v1 includes this or defers it.

- **D4 — Chunk size invariants.** Port the three from `component_analyzer.py`:
  (1) mutually exclusive, (2) gap-free reassembly, (3) each `< ~10k tokens`
  (estimate `chars/4`), recursively split larger ones (cap recursion depth ~15).
  These are the unit-test targets for the chunker (like `extract.test.ts` tests
  `aggregateDesignData`).

- **D5 — Orchestrator assembly.** Generate `src/App.tsx` + `src/main.tsx` from
  **what workers actually produced**, importing each section component and ordering by
  `semanticType`. Decide: deterministic codegen-free assembly (build imports/JSX in TS
  from the file list — cheaper, no model call, recommended) vs. a model-driven assembly
  pass.

- **D6 — Per-section fixes (Task 2.4).** When a build/fidelity error maps to a section
  by file path, re-run only that section's worker. Decide the error→section mapping
  (esbuild error paths contain `src/components/sections/<id>/...`). Cross-cutting errors
  (entry/config) fall back to whole-project fix.

- **D7 — Failure degradation.** `continueOnFailure`: a failed/timed-out section becomes
  a visible placeholder component rather than failing the whole run. Decide placeholder
  shape.

## Proposed task skeleton (to be made concrete after brainstorming)

1. **Chunker** (`server/lib/chunker.ts`, pure + unit-tested): `capture.html` → `Section[]`
   honoring D4 invariants. Decide D1/D2 first.
2. **Per-section screenshot crop** (if D3 in scope): pure `cropSectionShot(fullPng, sections, i)`.
3. **`generateSection`** in `ai.ts`: section-scoped worker reusing Phase-1 caching/compression.
4. **Orchestration in `run.ts`**: bounded-concurrency fan-out (semaphore), `continueOnFailure`,
   behind `CODEGEN_MODE`.
5. **Orchestrator assembly** (D5): deterministic `App.tsx`/`main.tsx` from produced files.
6. **Per-section fixes** (D6): error→section routing in the fix loop.
7. **Flag + metrics** (`server/env.ts` `CODEGEN_MODE`, per-run logging: section count,
   workers, tokens, wall-clock/stage, fidelity).

## Exit criteria (from the original doc)

Large pages that previously truncated now produce complete multi-file clones; codegen
wall-clock drops via parallelism; fidelity on fixtures improves; single-pass fallback
still works behind the flag.

## Verification

Unit-test the chunker invariants on a captured HTML fixture. End-to-end: clone the
large/long fixture (the truncation repro) and confirm N concurrent workers, complete
multi-file output, and wall-clock < single-pass. Keep the Phase-1 fixtures.

---

## Still pending after Phase 2

- **Phase 3 — real-error self-correction gate** (the original doc, Phase 3): scrape
  runtime/console errors + white-screen heuristic from the served preview
  (`server/lib/browser.ts` already uses puppeteer-core), block completion while errors
  exist (bounded), reconcile the pixel + judge fidelity signals. More concrete than
  Phase 2 but still has design choices (white-screen heuristic; signal reconciliation
  policy) — ready to brainstorm → plan after Phase 2.
- **Phase 4 — optional hardening** (the original doc): SSE progress, capture reuse, run
  queue, crash recovery, `PreviewSession` dedup, multi-page, `stack` honoring. Plus the
  Phase-1 deferred items: `/proxy-image` SSRF guard, `sandbox.ts serve()` idempotency.
