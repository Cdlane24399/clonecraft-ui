# Fidelity & Performance Uplift — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut tokens/cost per clone run and lift the fidelity floor — verbatim copy, real images, compressed vision payloads, prompt caching, and no silent truncation — without any architectural change.

**Architecture:** Phase 1 is surgical. We extract the codegen prompt into a pure, testable module; add a pure image-downscale helper; add prompt-cache breakpoints on the stable prefix (system + design spec + original screenshot) at the `server/lib/ai.ts` boundary; detect truncated codegen and request a bounded continuation; and replace the sandbox's `python3 -m http.server` with a tiny static+proxy server so real `<img>` assets render. The single-pass pipeline shape is unchanged — these are drop-in improvements behind the existing code paths.

**Tech Stack:** TypeScript (ESM, `"type": "module"`), Node ≥20, Hono server, Vercel AI SDK (`ai` v6) via the AI Gateway, `pngjs` + `pixelmatch` for image work, E2B sandboxes, `puppeteer-core` + Browserless for capture, Vitest v4 for tests.

## Global Constraints

- **Surgical edits near sensitive config.** Touch only target lines near auth, CSP, E2B keys, allowlists. Call it out when an edit lands near such a line.
- **Backwards compatible.** No behavior change when a feature can't run (E2B unset, gateway strips cache metadata, extraction returns empty spec). Every new path degrades to today's behavior.
- **Keep E2B.** Do not introduce an unsandboxed local subprocess. The image proxy must run *inside* the sandbox.
- **Hard caps only.** Any new loop/continuation has a fixed, small bound (no unbounded retries).
- **No new heavy/native dependencies.** `sharp` is NOT installed and must not be added; image compression uses pure `pngjs` (already a dependency).
- **Test runner:** `npx vitest run <path>` (config `vitest.config.ts` already includes `server/**/*.{test,spec}.{ts,tsx}`). Server-side unit files start with `// @vitest-environment node`.
- **Server typecheck:** use `npx tsc -p tsconfig.server.json --noEmit` — the root `tsc --noEmit` does NOT typecheck `server/` (it only references `src` + `vite.config.ts`).
- **Verify each phase by running a real clone**, not just unit tests — small page, large/long page, and image-heavy page fixtures.

---

## Task 1: Verbatim-conversion codegen prompt + feed page text

Highest-leverage fidelity change, zero dependencies. Extract the inline codegen prompt and system string from `server/pipeline/run.ts` into a pure, unit-testable module; add an explicit "CONVERTER, not content creator" contract; and feed the captured page text into codegen as source-of-truth copy (today `capture.text` only reaches *vision*, not codegen).

**Files:**
- Create: `server/lib/codegenPrompt.ts`
- Create: `server/lib/codegenPrompt.test.ts`
- Modify: `server/pipeline/run.ts` (remove inline `STACK_LABEL`/`GOAL_LABEL`/`CODEGEN_SYSTEM` at lines 85–120 and the inline codegen prompt at lines 245–265; import from the new module and pass `capture.text`)

**Interfaces:**
- Produces (consumed by Task 3 and Task 5):
  - `STACK_LABEL: Record<RunConfig["stack"], string>`
  - `GOAL_LABEL: Record<RunConfig["goal"], string>`
  - `CODEGEN_SYSTEM(stack: RunConfig["stack"]): string`
  - `buildCodegenPrompt(args: { stack: RunConfig["stack"]; goal: RunConfig["goal"]; passList: string[]; designSpec: string; tokens: { colors: { name: string; value: string }[]; fonts: string[] }; brief: string; components: { name: string }[]; pageText: string }): string`

- [ ] **Step 1: Write the failing test**

Create `server/lib/codegenPrompt.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { CODEGEN_SYSTEM, buildCodegenPrompt, STACK_LABEL } from "./codegenPrompt";

describe("CODEGEN_SYSTEM", () => {
  it("frames the model as a verbatim converter with explicit copy rules", () => {
    const sys = CODEGEN_SYSTEM("react");
    expect(sys).toMatch(/CONVERTER/i);
    expect(sys).toMatch(/word[- ]for[- ]word/i);
    expect(sys).toMatch(/lorem ipsum/i); // forbids placeholder copy
    expect(sys).toMatch(/example\.com/i); // forbids placeholder URLs
    // Keeps the existing z-index / gradient guidance.
    expect(sys).toMatch(/z-0|z-\[0\]/);
  });
});

describe("buildCodegenPrompt", () => {
  const base = {
    stack: "react" as const,
    goal: "recreate" as const,
    passList: [],
    designSpec: "# Measured design system\naccent #2563eb",
    tokens: { colors: [{ name: "accent", value: "#2563eb" }], fonts: ["Inter"] },
    brief: "",
    components: [{ name: "Navbar" }, { name: "Hero" }],
    pageText: "Ship faster with Acme. Start your free trial today.",
  };

  it("includes the captured page text as source-of-truth copy", () => {
    const p = buildCodegenPrompt(base);
    expect(p).toContain("Ship faster with Acme");
  });

  it("includes the design spec when present and the stack label", () => {
    const p = buildCodegenPrompt(base);
    expect(p).toContain("Measured design system");
    expect(p).toContain(STACK_LABEL.react);
  });

  it("falls back to inline token list when no design spec", () => {
    const p = buildCodegenPrompt({ ...base, designSpec: "" });
    expect(p).toContain("#2563eb"); // color value still conveyed
    expect(p).toContain("Inter");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/codegenPrompt.test.ts`
Expected: FAIL — `Cannot find module './codegenPrompt'`.

- [ ] **Step 3: Create the module**

Create `server/lib/codegenPrompt.ts`. Port `STACK_LABEL`, `GOAL_LABEL`, and `CODEGEN_SYSTEM` verbatim from `run.ts`, then add the conversion contract and `buildCodegenPrompt`:

```ts
import type { RunConfig } from "../db/schema";

export const STACK_LABEL: Record<RunConfig["stack"], string> = {
  react: "React + Tailwind CSS",
  next: "Next.js (App Router) + Tailwind CSS",
  html: "static HTML + CSS",
};

export const GOAL_LABEL: Record<RunConfig["goal"], string> = {
  recreate: "Recreate the page as a high-fidelity match.",
  redesign: "Recreate the structure but modernize the visual layer.",
  rebrand: "Recreate the layout but swap palette, typography, and logo for a fresh brand.",
  saas: "Recreate the marketing page and add an authenticated dashboard shell.",
};

// How much of the captured page text to feed codegen as ground-truth copy.
// Generous (the model needs the real words) but bounded so we never blow the
// input budget on a pathologically long page.
const MAX_PAGE_TEXT_CHARS = 8000;

export const CODEGEN_SYSTEM = (stack: RunConfig["stack"]) =>
  `You are an expert frontend engineer CONVERTING a real, measured web page into ` +
  `clean, production-quality ${STACK_LABEL[stack]} code. You are a CONVERTER, not a ` +
  `content creator. Reproduce what is actually on the page; do not invent, summarize, ` +
  `or "improve" it.\n` +
  `COPY RULES (non-negotiable):\n` +
  `✅ Reproduce all visible text WORD-FOR-WORD from the provided page text.\n` +
  `✅ Keep every URL/href exactly as given.\n` +
  "✅ Convert `class` to `className`.\n" +
  `❌ No Lorem ipsum. ❌ No example.com or other placeholder URLs. ` +
  `❌ Do not summarize, shorten, paraphrase, or invent copy.\n\n` +
  `Output ONLY fenced code blocks, each tagged with its path ` +
  "like ```tsx file=src/App.tsx. The top-level component MUST be `export default` in src/App.tsx. " +
  "Make components self-contained and import siblings with relative paths. " +
  "Use Tailwind utility classes for all styling (a Tailwind runtime is present). " +
  "When a measured design system is provided (exact hex colors, a type scale in px, " +
  "spacing values, button styles, and the page's section order), treat those values as " +
  "ground truth read from the real page — match them precisely (use arbitrary Tailwind " +
  "values like text-[17px], bg-[#0b1120], gap-[28px] when needed) rather than approximating. " +
  "Reproduce the sections in the given order with the given backgrounds and proportions. " +
  "Reproduce full-bleed gradient or shader/canvas backgrounds as layered CSS gradients " +
  "(linear/radial) using the measured gradient colors. If the design spec says the " +
  "background animates, add a subtle CSS keyframe animation (e.g. slowly drifting " +
  "background-position, or large blurred radial-gradient blobs that move/pulse on a long " +
  "ease-in-out loop) — keep it tasteful and performant, no external libraries. CRITICAL: render a decorative " +
  "background layer with `z-0` (or `z-[0]`) inside a `relative` section and put the content " +
  "in a sibling with `relative z-10` — NEVER place a background on a negatively z-indexed " +
  "layer (`-z-10`): it paints behind the page's opaque root background and disappears. " +
  "Do not import images or external assets; use inline SVG or CSS gradients/solid colors. " +
  "lucide-react is available for icons, but only generic icons — its brand icons " +
  "(Github, Twitter, Linkedin, Facebook, etc.) were removed, so render brand marks " +
  "as inline SVG instead. Do not include explanatory prose outside the code blocks.";

export function buildCodegenPrompt(args: {
  stack: RunConfig["stack"];
  goal: RunConfig["goal"];
  passList: string[];
  designSpec: string;
  tokens: { colors: { name: string; value: string }[]; fonts: string[] };
  brief: string;
  components: { name: string }[];
  pageText: string;
}): string {
  const { stack, goal, passList, designSpec, tokens, brief, components, pageText } = args;
  const copyBlock = pageText.trim()
    ? `\n\nSOURCE-OF-TRUTH PAGE COPY (reproduce this text verbatim where it appears; ` +
      `do not paraphrase):\n"""\n${pageText.slice(0, MAX_PAGE_TEXT_CHARS)}\n"""\n`
    : "";

  return (
    `Recreate this page as ${STACK_LABEL[stack]}. Goal: ${GOAL_LABEL[goal]} ` +
    `Apply these passes where relevant: ${passList.join(", ") || "none"}. ` +
    (designSpec
      ? `\n\n${designSpec}\n\n`
      : `Use this extracted design system — colors: ${tokens.colors
          .map((c) => `${c.name} ${c.value}`)
          .join(", ")}; fonts: ${tokens.fonts.join(", ")}. `) +
    (brief ? `Brand details: ${brief}. ` : "") +
    `Detected components: ${components.map((c) => c.name).join(", ")}. ` +
    `Produce a top-level src/App.tsx (export default) plus a component file per major section` +
    (designSpec ? `, matching the measured palette, type scale, spacing and section order above as closely as possible. ` : ". ") +
    `Keep it to real, compiling TSX.` +
    copyBlock
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/codegenPrompt.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire run.ts to the new module**

In `server/pipeline/run.ts`:

1. Add to the imports near the top (after the existing `../lib/*` imports):

```ts
import { CODEGEN_SYSTEM, STACK_LABEL, buildCodegenPrompt } from "../lib/codegenPrompt";
```

2. Delete the now-duplicated `STACK_LABEL`, `GOAL_LABEL`, and `CODEGEN_SYSTEM` definitions (lines 85–120). `GOAL_LABEL` is only used inside the prompt builder now, so it does not need re-importing; `STACK_LABEL` is still referenced in `emit(...)` log lines, hence the import above.

3. Replace the inline codegen call (lines 249–265) with:

```ts
    const codeMd = await generateCode({
      screenshotBase64: capture.screenshotBase64,
      system: CODEGEN_SYSTEM(config.stack),
      prompt: buildCodegenPrompt({
        stack: config.stack,
        goal: config.goal,
        passList,
        designSpec,
        tokens,
        brief,
        components: analysis.components,
        pageText: capture.text,
      }),
    });
```

- [ ] **Step 6: Run the full server test suite + typecheck**

Run: `npx vitest run server/ && npx tsc -p tsconfig.server.json --noEmit`
Expected: all tests PASS; no type errors. (`tsc --noEmit` catches any dangling reference to the deleted `run.ts` constants.)

- [ ] **Step 7: Commit**

```bash
git add server/lib/codegenPrompt.ts server/lib/codegenPrompt.test.ts server/pipeline/run.ts
git commit -m "feat(codegen): verbatim-conversion prompt + feed page text to codegen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Compress inspection screenshots for vision (pure pngjs downscale)

The original + rendered PNGs (up to 1440×7600) are re-sent to vision-analysis, judge, and every fix pass. Anthropic also re-resizes oversized images server-side, so for tall captures we want to control the downscale ourselves (better quality + smaller payload), and for wide-but-short clones it materially cuts vision input tokens. We downscale at the `ai.ts` boundary only and **keep the full-res PNG for the pixel diff** (`visualDiff.ts` / `capture.screenshotBase64` are untouched).

**Files:**
- Create: `server/lib/imageCompress.ts`
- Create: `server/lib/imageCompress.test.ts`
- Modify: `server/lib/ai.ts` (downscale image parts in `analyzeWithVision`, `judgeVisualDifferences`, `fixVisualFidelity`)

**Interfaces:**
- Produces: `compressForVision(base64png: string, maxLongEdge?: number): string` — takes a base64 PNG (no `data:` prefix), returns a base64 PNG downscaled so its longest edge ≤ `maxLongEdge` (default 1536). Returns the input unchanged if it is already within bounds or cannot be decoded.

- [ ] **Step 1: Write the failing test**

Create `server/lib/imageCompress.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { compressForVision } from "./imageCompress";

function solidPng(width: number, height: number): string {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 10;       // r
    png.data[i + 1] = 120;  // g
    png.data[i + 2] = 200;  // b
    png.data[i + 3] = 255;  // a
  }
  return PNG.sync.write(png).toString("base64");
}

describe("compressForVision", () => {
  it("downscales a tall image so the long edge is within the cap", () => {
    const out = compressForVision(solidPng(1440, 6000), 1536);
    const decoded = PNG.sync.read(Buffer.from(out, "base64"));
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(1536);
    expect(decoded.width).toBeGreaterThan(0);
    // Aspect ratio preserved (within rounding).
    expect(decoded.width / decoded.height).toBeCloseTo(1440 / 6000, 1);
  });

  it("downscales a wide image by its width", () => {
    const out = compressForVision(solidPng(3000, 800), 1536);
    const decoded = PNG.sync.read(Buffer.from(out, "base64"));
    expect(decoded.width).toBeLessThanOrEqual(1536);
  });

  it("returns the input unchanged when already within the cap", () => {
    const small = solidPng(800, 600);
    expect(compressForVision(small, 1536)).toBe(small);
  });

  it("returns the input unchanged on undecodable data instead of throwing", () => {
    expect(compressForVision("not-a-png", 1536)).toBe("not-a-png");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/imageCompress.test.ts`
Expected: FAIL — `Cannot find module './imageCompress'`.

- [ ] **Step 3: Implement the downscaler**

Create `server/lib/imageCompress.ts` (pure pngjs, box-average downscale, no new deps):

```ts
import { PNG } from "pngjs";

// Default long-edge cap. Anthropic resizes images whose long edge exceeds
// ~1568px before tokenizing, so capping at 1536 keeps us at/under that bound
// while controlling the downscale quality ourselves and shrinking the payload.
const DEFAULT_MAX_LONG_EDGE = 1536;

/**
 * Downscale a base64 PNG (no `data:` prefix) so its longest edge is within
 * `maxLongEdge`, preserving aspect ratio. Used ONLY for the vision/judge/fix
 * image parts — the pixel diff keeps the full-resolution capture. Best-effort:
 * if the image is already small enough or can't be decoded, the input is
 * returned unchanged so callers never break on a bad screenshot.
 */
export function compressForVision(
  base64png: string,
  maxLongEdge: number = DEFAULT_MAX_LONG_EDGE
): string {
  let src: PNG;
  try {
    src = PNG.sync.read(Buffer.from(base64png, "base64"));
  } catch {
    return base64png;
  }
  const longEdge = Math.max(src.width, src.height);
  if (longEdge <= maxLongEdge) return base64png;

  const scale = maxLongEdge / longEdge;
  const dstW = Math.max(1, Math.round(src.width * scale));
  const dstH = Math.max(1, Math.round(src.height * scale));
  const dst = new PNG({ width: dstW, height: dstH });

  // Box-average downscale: each destination pixel averages the source block it
  // maps to. Cheap, dependency-free, and good enough for a vision model.
  const xRatio = src.width / dstW;
  const yRatio = src.height / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy0 = Math.floor(y * yRatio);
    const sy1 = Math.min(src.height, Math.floor((y + 1) * yRatio) || sy0 + 1);
    for (let x = 0; x < dstW; x++) {
      const sx0 = Math.floor(x * xRatio);
      const sx1 = Math.min(src.width, Math.floor((x + 1) * xRatio) || sx0 + 1);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * src.width + sx) * 4;
          r += src.data[i]; g += src.data[i + 1];
          b += src.data[i + 2]; a += src.data[i + 3];
          n++;
        }
      }
      const di = (y * dstW + x) * 4;
      dst.data[di] = Math.round(r / n);
      dst.data[di + 1] = Math.round(g / n);
      dst.data[di + 2] = Math.round(b / n);
      dst.data[di + 3] = Math.round(a / n);
    }
  }
  return PNG.sync.write(dst).toString("base64");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/imageCompress.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Apply compression at the ai.ts image boundary**

In `server/lib/ai.ts`, add the import and downscale each image buffer. **Do not** change `visualDiff.ts` or any pixel-diff call.

1. Add import at top:

```ts
import { compressForVision } from "./imageCompress";
```

2. In `analyzeWithVision`, change the image part:

```ts
          { type: "image", image: Buffer.from(compressForVision(args.screenshotBase64), "base64") },
```

3. In `judgeVisualDifferences`, change both image parts the same way (`args.originalBase64`, `args.renderedBase64`):

```ts
          { type: "image", image: Buffer.from(compressForVision(args.originalBase64), "base64") },
          ...
          { type: "image", image: Buffer.from(compressForVision(args.renderedBase64), "base64") },
```

4. In `fixVisualFidelity`, change both image parts (`args.originalBase64`, `args.renderedBase64`) identically.

Leave `generateCode`'s screenshot uncompressed for now — Task 3 changes that call's structure and will compress it there alongside caching.

- [ ] **Step 6: Run the server suite + typecheck**

Run: `npx vitest run server/ && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS, no type errors. The existing `fidelity.test.ts` mocks `./ai`, so it is unaffected.

- [ ] **Step 7: Commit**

```bash
git add server/lib/imageCompress.ts server/lib/imageCompress.test.ts server/lib/ai.ts
git commit -m "feat(ai): downscale screenshots for vision/judge/fix (keep full-res for pixel diff)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Prompt caching on the stable prefix (system + design spec + original screenshot)

`CODEGEN_SYSTEM` (~1.5k tokens), the design spec (multi-k), and the original screenshot are identical across the generate call and every fix/fidelity call in a run. Mark them as Anthropic ephemeral cache breakpoints so passes 2+ read them from cache (~10% cost, faster TTFT). The volatile per-call delta (instructions, errors, diffs, the rendered screenshot) stays uncached.

> **Execution caveat (do not skip):** It is unverified whether the Vercel AI Gateway forwards `providerOptions.anthropic.cacheControl` to Anthropic. The unit test below only proves we *construct* the breakpoints correctly. Step 6 is a **real-clone usage check**: if cache-read tokens stay at zero on fix passes, the gateway is stripping the metadata — record that finding and stop here (do not chase it in Phase 1). The fallback (calling `@anthropic-ai/sdk` directly for codegen — it is already a dependency) is out of scope for Phase 1.

**Files:**
- Modify: `server/lib/ai.ts` (`generateCode`, `fixVisualFidelity`, `fixCode` — restructure into cached/uncached content parts; add usage logging)
- Create: `server/lib/ai.test.ts` (test the cache-part builder)

**Interfaces:**
- Consumes: `compressForVision` (Task 2).
- Produces (internal to `ai.ts`, exported for test):
  - `EPHEMERAL` provider-options constant.
  - `buildCachedUserContent(args: { imageBase64: string; designSpec: string; instructions: string }): Array<...>` — returns ordered content parts `[image(ephemeral), spec-text(ephemeral, only if non-empty), instructions-text(uncached)]`.
- Changes `generateCode` signature to accept the design spec separately so it can be cached as its own part:
  `generateCode(args: { screenshotBase64: string; system: string; designSpec: string; instructions: string }): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `server/lib/ai.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildCachedUserContent, EPHEMERAL } from "./ai";

const EPH = { anthropic: { cacheControl: { type: "ephemeral" } } };

describe("EPHEMERAL", () => {
  it("is the Anthropic ephemeral cache-control provider option", () => {
    expect(EPHEMERAL).toEqual(EPH);
  });
});

describe("buildCachedUserContent", () => {
  it("marks the image and the design spec as cached, instructions uncached", () => {
    const parts = buildCachedUserContent({
      imageBase64: "aW1n", // "img"
      designSpec: "# spec",
      instructions: "do the thing",
    });
    // Order: image, spec, instructions.
    expect(parts[0].type).toBe("image");
    expect(parts[0].providerOptions).toEqual(EPH);
    expect(parts[1].type).toBe("text");
    expect(parts[1].text).toContain("# spec");
    expect(parts[1].providerOptions).toEqual(EPH);
    expect(parts[2].type).toBe("text");
    expect(parts[2].text).toBe("do the thing");
    expect(parts[2].providerOptions).toBeUndefined();
  });

  it("omits the spec part entirely when the design spec is empty", () => {
    const parts = buildCachedUserContent({
      imageBase64: "aW1n",
      designSpec: "",
      instructions: "go",
    });
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe("image");
    expect(parts[1].text).toBe("go");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/ai.test.ts`
Expected: FAIL — `buildCachedUserContent`/`EPHEMERAL` not exported.

- [ ] **Step 3: Add the cache-part builder and usage logging to ai.ts**

In `server/lib/ai.ts`, add near the top (after imports):

```ts
import type { ImagePart, TextPart } from "ai";

/** Anthropic ephemeral prompt-cache breakpoint (5-min TTL). */
export const EPHEMERAL = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

/** Lightweight usage logger so we can confirm cache reads on passes 2+. */
function logUsage(label: string, usage: unknown) {
  // The AI SDK surfaces cache fields under usage (cachedInputTokens) and/or
  // providerMetadata.anthropic. Log the raw object so the real-clone check can
  // read cache-creation vs cache-read counts without guessing field names.
  console.log(`[usage:${label}]`, JSON.stringify(usage));
}

/**
 * Build the cached prefix for a codegen/fix message: the (downscaled) image and
 * the design spec are stable across a run, so they become ephemeral cache
 * breakpoints; the per-call instructions stay uncached. Spec part is omitted
 * when empty so we never create a zero-length breakpoint.
 */
export function buildCachedUserContent(args: {
  imageBase64: string;
  designSpec: string;
  instructions: string;
}): Array<ImagePart | TextPart> {
  const parts: Array<ImagePart | TextPart> = [
    {
      type: "image",
      image: Buffer.from(compressForVision(args.imageBase64), "base64"),
      providerOptions: EPHEMERAL,
    },
  ];
  if (args.designSpec.trim()) {
    parts.push({
      type: "text",
      text:
        `Measured design system (ground truth read from the real page — match exactly):\n${args.designSpec}`,
      providerOptions: EPHEMERAL,
    });
  }
  parts.push({ type: "text", text: args.instructions });
  return parts;
}
```

- [ ] **Step 4: Rewrite `generateCode` to use the cached prefix + a cached system message**

Replace the body of `generateCode` with:

```ts
export async function generateCode(args: {
  screenshotBase64: string;
  system: string;
  designSpec: string;
  instructions: string;
}): Promise<string> {
  const result = streamText({
    model: MODELS.codegen,
    maxOutputTokens: 32000,
    messages: [
      { role: "system", content: args.system, providerOptions: EPHEMERAL },
      { role: "user", content: buildCachedUserContent(args) },
    ],
  });
  const text = await result.text;
  logUsage("codegen", await result.usage);
  return text;
}
```

Then update the caller in `server/pipeline/run.ts` (the Task 1 call site) to pass `designSpec` + `instructions` instead of a single `prompt`:

```ts
    const codeMd = await generateCode({
      screenshotBase64: capture.screenshotBase64,
      system: CODEGEN_SYSTEM(config.stack),
      designSpec,
      instructions: buildCodegenPrompt({
        stack: config.stack,
        goal: config.goal,
        passList,
        designSpec: "", // spec is now sent as its own cached part; don't duplicate it
        tokens,
        brief,
        components: analysis.components,
        pageText: capture.text,
      }),
    });
```

> Note: passing `designSpec: ""` into `buildCodegenPrompt` means the prompt falls back to the inline token list for color/font hints while the *full* spec rides the cached part. This keeps the spec in exactly one place (the cached breakpoint).

- [ ] **Step 5: Add cached system + usage logging to `fixVisualFidelity` and `fixCode`**

In `fixVisualFidelity`, convert `system` to a cached system message and mark the **original** image (stable) ephemeral while leaving the **rendered** image and the differences/files uncached. Concretely, change the `streamText` call to:

```ts
  const result = streamText({
    model: MODELS.codegen,
    maxOutputTokens: 32000,
    messages: [
      { role: "system", content: args.system, providerOptions: EPHEMERAL },
      {
        role: "user",
        content: [
          { type: "text", text: "TARGET — the original page the clone must match pixel-for-pixel:" },
          {
            type: "image",
            image: Buffer.from(compressForVision(args.originalBase64), "base64"),
            providerOptions: EPHEMERAL,
          },
          { type: "text", text: "CURRENT — how your clone renders right now (it is not close enough):" },
          { type: "image", image: Buffer.from(compressForVision(args.renderedBase64), "base64") },
          {
            type: "text",
            text:
              `Revise the code to close these specific visual gaps, highest severity first:\n${args.differences}\n\n` +
              `Pay special attention to VERTICAL PROPORTIONS: match each section's height and ` +
              `padding to the original. A section that is too short or too tall shifts everything ` +
              `below it out of alignment, which dominates the fidelity comparison — getting the ` +
              `hero and section heights right matters more than small cosmetic tweaks.\n\n` +
              (args.designSpec
                ? `Honor this measured design system exactly (these are real values read from the original's computed styles — including each section's measured pixel height):\n${args.designSpec}\n\n`
                : "") +
              `Return the COMPLETE corrected set of files as fenced code blocks tagged with ` +
              `their path (e.g. \`\`\`tsx file=src/App.tsx). Keep the project building cleanly. ` +
              `Do not omit unchanged files and do not add prose.\n\n` +
              `--- CURRENT FILES ---\n${filesBlock}`,
          },
        ],
      },
    ],
  });
  const text = await result.text;
  logUsage("fidelity-fix", await result.usage);
  return text;
```

In `fixCode`, convert to a cached system message (no images on this path):

```ts
  const result = streamText({
    model: MODELS.codegen,
    maxOutputTokens: 32000,
    messages: [
      { role: "system", content: args.system, providerOptions: EPHEMERAL },
      {
        role: "user",
        content:
          `The following generated project failed to build. Fix every error and ` +
          `return the COMPLETE corrected set of files as fenced code blocks tagged ` +
          `with their path (e.g. \`\`\`tsx file=src/App.tsx). Do not omit unchanged ` +
          `files and do not add prose.\n\n` +
          `--- BUILD ERRORS ---\n${args.errors.slice(0, 6000)}\n\n` +
          `--- CURRENT FILES ---\n${filesBlock}`,
      },
    ],
  });
  const text = await result.text;
  logUsage("build-fix", await result.usage);
  return text;
```

(These three functions already build `filesBlock` before the `streamText` call — leave that code as-is.)

- [ ] **Step 6: Run the test + suite + typecheck**

Run: `npx vitest run server/ && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS (incl. new `ai.test.ts`), no type errors.

- [ ] **Step 7: Commit**

```bash
git add server/lib/ai.ts server/lib/ai.test.ts server/pipeline/run.ts
git commit -m "feat(ai): ephemeral prompt caching on system + design spec + screenshot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 8: Real-clone usage verification (manual, blocking for the cache claim)**

Start the app (`npm run dev`, with `DATABASE_URL`, `BROWSERLESS_*`, `E2B_API_KEY`, and AI Gateway auth set) and clone a page that triggers at least one fix or fidelity pass. Watch the server stdout for `[usage:codegen]` / `[usage:build-fix]` / `[usage:fidelity-fix]` lines.
Expected: on pass 2+, the usage object shows non-zero cached/cache-read input tokens (field name e.g. `cachedInputTokens`), i.e. the stable prefix is being read from cache.
If cache reads stay 0: the gateway is stripping `providerOptions.anthropic`. Record this in the plan's notes and stop — do not pursue the direct-SDK fallback in Phase 1.

---

## Task 4: Truncation guardrail with bounded continuation

A 32k-capped single pass can still truncate on a large page. Today the regex parser silently drops the unterminated block and the fallback dumps everything into one `App.tsx`. Detect truncation (odd fence count, or `finishReason === "length"`) and request exactly one continuation instead of failing silently.

**Files:**
- Modify: `server/lib/codegenFiles.ts` (add `isLikelyTruncated`)
- Modify: `server/lib/codegenFiles.test.ts` if it exists, else create it
- Modify: `server/lib/ai.ts` (`generateCode` returns `finishReason`; add `continueGeneration`)
- Modify: `server/pipeline/run.ts` (warn + one bounded continuation when truncation is detected)

**Interfaces:**
- Consumes: `generateCode` (Task 3 shape).
- Produces:
  - `isLikelyTruncated(markdown: string): boolean` (in `codegenFiles.ts`).
  - `generateCode(...) => Promise<{ text: string; finishReason: string }>` (return type change).
  - `continueGeneration(args: { system: string; previousText: string }): Promise<string>` (in `ai.ts`).

- [ ] **Step 1: Write the failing test**

Create `server/lib/codegenFiles.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseGeneratedFiles, isLikelyTruncated } from "./codegenFiles";

describe("isLikelyTruncated", () => {
  it("is false for balanced fenced blocks", () => {
    const md = "```tsx file=src/App.tsx\nexport default () => null;\n```";
    expect(isLikelyTruncated(md)).toBe(false);
  });

  it("is true for an unterminated final block (odd fence count)", () => {
    const md =
      "```tsx file=src/App.tsx\nexport default () => null;\n```\n\n" +
      "```tsx file=src/Hero.tsx\nexport function Hero() { return (";
    expect(isLikelyTruncated(md)).toBe(true);
  });

  it("is false for empty output (nothing to continue)", () => {
    expect(isLikelyTruncated("")).toBe(false);
  });
});

describe("parseGeneratedFiles (regression)", () => {
  it("still parses balanced blocks", () => {
    const md = "```tsx file=src/App.tsx\nhi\n```";
    expect(parseGeneratedFiles(md)).toEqual([{ path: "src/App.tsx", content: "hi\n" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/lib/codegenFiles.test.ts`
Expected: FAIL — `isLikelyTruncated` not exported.

- [ ] **Step 3: Implement `isLikelyTruncated`**

Append to `server/lib/codegenFiles.ts`:

```ts
/**
 * Heuristic: did the model's fenced output get cut off mid-block? An even number
 * of ``` fences means every opened block was closed; an odd count means the last
 * block is unterminated (the classic 32k-truncation signature). Empty output is
 * not "truncated" — there's nothing to continue.
 */
export function isLikelyTruncated(markdown: string): boolean {
  if (!markdown.trim()) return false;
  const fences = markdown.match(/```/g)?.length ?? 0;
  return fences % 2 === 1;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/lib/codegenFiles.test.ts`
Expected: PASS.

- [ ] **Step 5: Return `finishReason` from `generateCode` and add `continueGeneration`**

In `server/lib/ai.ts`, change `generateCode` to return both text and finish reason:

```ts
export async function generateCode(args: {
  screenshotBase64: string;
  system: string;
  designSpec: string;
  instructions: string;
}): Promise<{ text: string; finishReason: string }> {
  const result = streamText({
    model: MODELS.codegen,
    maxOutputTokens: 32000,
    messages: [
      { role: "system", content: args.system, providerOptions: EPHEMERAL },
      { role: "user", content: buildCachedUserContent(args) },
    ],
  });
  const text = await result.text;
  logUsage("codegen", await result.usage);
  return { text, finishReason: await result.finishReason };
}
```

Add a bounded continuation helper:

```ts
/**
 * Ask the model to continue a codegen response that was cut off mid-block.
 * Returns ONLY the continuation text; the caller concatenates it to the
 * previous output before parsing. Called at most once per run (hard cap).
 */
export async function continueGeneration(args: {
  system: string;
  previousText: string;
}): Promise<string> {
  const result = streamText({
    model: MODELS.codegen,
    maxOutputTokens: 32000,
    messages: [
      { role: "system", content: args.system, providerOptions: EPHEMERAL },
      {
        role: "user",
        content:
          `Your previous response was cut off. Continue EXACTLY where you stopped — ` +
          `do not repeat any already-emitted text, do not restart files, and keep using ` +
          "the same ```tsx file=<path> fenced format. Here is everything you have " +
          `emitted so far:\n\n${args.previousText}`,
      },
    ],
  });
  return await result.text;
}
```

- [ ] **Step 6: Wire the continuation into run.ts**

In `server/pipeline/run.ts`, update the codegen block. Replace:

```ts
    let files = parseGeneratedFiles(codeMd);
    if (files.length === 0) files = [{ path: "src/App.tsx", content: codeMd }];
```

with (and change the `const codeMd = await generateCode(...)` to destructure):

```ts
    const gen = await generateCode({
      screenshotBase64: capture.screenshotBase64,
      system: CODEGEN_SYSTEM(config.stack),
      designSpec,
      instructions: buildCodegenPrompt({
        stack: config.stack,
        goal: config.goal,
        passList,
        designSpec: "",
        tokens,
        brief,
        components: analysis.components,
        pageText: capture.text,
      }),
    });
    let codeMd = gen.text;

    // Truncation guardrail (stopgap until chunked codegen lands): a 32k-capped
    // single pass can cut off mid-file. Rather than silently dropping the
    // unterminated block, request ONE continuation and stitch it on.
    if (gen.finishReason === "length" || isLikelyTruncated(codeMd)) {
      await pushLog(
        runId,
        `[codegen] Output looks truncated (finishReason=${gen.finishReason}) — requesting one continuation`
      );
      try {
        const more = await continueGeneration({ system: CODEGEN_SYSTEM(config.stack), previousText: codeMd });
        codeMd = codeMd + "\n" + more;
      } catch (e) {
        await pushLog(runId, `[codegen] Continuation failed (${(e as Error).message}) — using partial output`);
      }
    }

    let files = parseGeneratedFiles(codeMd);
    if (files.length === 0) files = [{ path: "src/App.tsx", content: codeMd }];
```

Add `isLikelyTruncated` and `continueGeneration` to the existing imports:

```ts
import { parseGeneratedFiles, isLikelyTruncated } from "../lib/codegenFiles";
import { analyzeWithVision, generateCode, fixCode, continueGeneration } from "../lib/ai";
```

- [ ] **Step 7: Run suite + typecheck**

Run: `npx vitest run server/ && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add server/lib/codegenFiles.ts server/lib/codegenFiles.test.ts server/lib/ai.ts server/pipeline/run.ts
git commit -m "feat(codegen): detect truncated output and request a bounded continuation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 9: Real-clone truncation verification (manual)**

Temporarily lower `maxOutputTokens` in `generateCode` (e.g. to `1200`) and clone a content-rich page. Confirm the `[codegen] Output looks truncated … requesting one continuation` log fires and the result is **not** a single merged `App.tsx`. Revert `maxOutputTokens` to `32000` afterward.

---

## Task 5: Image proxy so cloned images render in preview

The prompt forbids external images to dodge CORS, which loses real imagery and corrupts the pixel diff. The E2B preview is served by `python3 -m http.server` (no proxy capability), so we replace it with a tiny static-plus-proxy Python server that fetches external images server-side with permissive CORS, then relax the prompt to allow `<img src="/proxy-image?url=...">`.

**Files:**
- Modify: `server/lib/sandbox.ts` (write a `server.py`; serve via it instead of `python3 -m http.server`)
- Modify: `agent-codegen/agent/lib/preview.ts` (mirror the identical change — the two `PreviewSession`s must stay byte-compatible so reconnection works)
- Modify: `server/lib/codegenPrompt.ts` (`CODEGEN_SYSTEM`: allow proxied `<img>` for real assets, keep inline-SVG fallback for brand marks)

> **Sensitive-edit note:** this changes the sandbox's served-preview command and adds an outbound-fetch endpoint *inside the sandbox*. It does NOT add any host-side subprocess — the proxy runs in E2B, preserving the sandbox boundary. Keep the `serve()` edit to the single command line.

**Interfaces:**
- Consumes: `CODEGEN_SYSTEM` (Tasks 1/3).
- Produces: a `/proxy-image?url=<encoded>` endpoint on the preview origin; all other paths serve static files from `public/` exactly as before.

- [ ] **Step 1: Add the proxy server constant to sandbox.ts**

In `server/lib/sandbox.ts`, add a `PROXY_SERVER_PY` constant near `INDEX_HTML`:

```ts
// A tiny static file server with a /proxy-image?url= endpoint. Replaces
// `python3 -m http.server` so cloned pages can render real external images
// (served back with permissive CORS) instead of being forced to inline-SVG.
// Runs INSIDE the E2B sandbox — no host-side process, sandbox boundary intact.
const PROXY_SERVER_PY = `import http.server, socketserver, urllib.parse, urllib.request, os
PORT = ${PREVIEW_PORT}
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy-image":
            qs = urllib.parse.parse_qs(parsed.query)
            url = (qs.get("url") or [""])[0]
            if not url.startswith(("http://", "https://")):
                self.send_error(400, "bad url"); return
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as r:
                    data = r.read()
                    ctype = r.headers.get("Content-Type", "image/png")
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_error(502, str(e))
            return
        return super().do_GET()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), H) as httpd:
    httpd.serve_forever()
`;
```

- [ ] **Step 2: Serve via the proxy server**

In `server/lib/sandbox.ts`, the `serve()` method currently runs `python3 -m http.server`. Change it to write `server.py` and run it. Replace the body of `serve()`:

```ts
  /** Serve the built bundle (with image proxy) and return its public URL. */
  async serve(): Promise<string> {
    await this.sandbox.files.write(`${APP_ROOT}/public/server.py`, PROXY_SERVER_PY);
    await this.sandbox.commands.run(
      `cd ${APP_ROOT}/public && nohup python3 server.py >/tmp/serve.log 2>&1 &`,
      { background: true }
    );
    const previewUrl = `https://${this.sandbox.getHost(PREVIEW_PORT)}`;
    await waitForUrl(previewUrl);
    return previewUrl;
  }
```

- [ ] **Step 3: Mirror the change in the agent preview**

Apply the identical `PROXY_SERVER_PY` constant and `serve()` change to `agent-codegen/agent/lib/preview.ts` (it has the same `INDEX_HTML`, `PREVIEW_PORT`, and a `served`/`previewUrl` memoized `serve()` — preserve that memoization, only swap the command):

```ts
  async serve(): Promise<string> {
    if (this.served && this.previewUrl) return this.previewUrl;
    await this.sandbox.files.write(`${APP_ROOT}/public/server.py`, PROXY_SERVER_PY);
    await this.sandbox.commands.run(
      `cd ${APP_ROOT}/public && nohup python3 server.py >/tmp/serve.log 2>&1 &`,
      { background: true }
    );
    const previewUrl = `https://${this.sandbox.getHost(PREVIEW_PORT)}`;
    await waitForUrl(previewUrl);
    this.served = true;
    this.previewUrl = previewUrl;
    return previewUrl;
  }
```

- [ ] **Step 4: Relax the codegen prompt to allow proxied images**

In `server/lib/codegenPrompt.ts`, change the line in `CODEGEN_SYSTEM`:

```ts
  "Do not import images or external assets; use inline SVG or CSS gradients/solid colors. " +
```

to:

```ts
  "For real photographic/hero imagery, use a normal img tag whose src goes through the " +
  "preview image proxy: <img src=\"/proxy-image?url=ENCODED_ABSOLUTE_URL\" /> where " +
  "ENCODED_ABSOLUTE_URL is the original image's absolute URL, URL-encoded. Use the " +
  "real image URLs visible in the page. For brand marks/logos and simple icons, prefer " +
  "inline SVG or CSS gradients/solid colors. Do not import images as ES modules. " +
```

- [ ] **Step 5: Update the system-prompt test**

In `server/lib/codegenPrompt.test.ts`, add a case to the `CODEGEN_SYSTEM` block:

```ts
  it("allows real images through the preview proxy", () => {
    const sys = CODEGEN_SYSTEM("react");
    expect(sys).toContain("/proxy-image?url=");
  });
```

- [ ] **Step 6: Run suite + typecheck**

Run: `npx vitest run server/ && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS (incl. the new system-prompt case), no type errors.

- [ ] **Step 7: Commit**

```bash
git add server/lib/sandbox.ts agent-codegen/agent/lib/preview.ts server/lib/codegenPrompt.ts server/lib/codegenPrompt.test.ts
git commit -m "feat(preview): in-sandbox image proxy so cloned external images render

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 8: Real-clone image verification (manual, requires E2B)**

Clone an image-heavy page. Confirm: (a) the served preview renders real photos (open the preview URL, and check `GET /proxy-image?url=...` returns 200 in `/tmp/serve.log`), and (b) the recorded fidelity score is higher than a pre-Task-5 run of the same page. If E2B is unset, this task's runtime behavior cannot be verified — note that and rely on the unit + typecheck gates.

---

## Phase 1 exit criteria

- **Cost:** real-clone usage logs show cache reads on fix passes (Task 3 Step 8) **or** a recorded finding that the gateway strips cache metadata; vision image payloads are downscaled (Task 2).
- **Fidelity floor:** clones reproduce visible copy verbatim (Task 1) and render real images in the preview (Task 5).
- **Robustness:** truncated codegen triggers a logged continuation instead of a silent one-file merge (Task 4).
- **No regressions:** `npx vitest run` (full suite) and `npx tsc -p tsconfig.server.json --noEmit` both pass; the single-pass pipeline shape is unchanged.

Run the before/after metric capture (tokens per run, wall-clock per stage, final fidelity score) on the two fixtures below.

## Test fixtures to keep around

- **Small page** (simple landing) — fast regression + before/after metrics.
- **Large/long page** (truncation repro) — exercises Task 4.
- **Image-heavy page** — exercises Task 5.

## Out of scope (deferred to later plans)

Phases 2–4 of `docs/plans/fidelity-performance-uplift.md`: chunked parallel section workers, the real-error self-correction gate, and the optional follow-ups (SSE progress, capture reuse, run queue, crash recovery, dedup of the two `PreviewSession`s, multi-page, `stack` honoring). Phase 2 is the top-priority structural change and should be the next plan.
```