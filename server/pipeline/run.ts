import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { runs } from "../db/schema";
import type { RunConfig, RunResult, GeneratedFile, DesignTokens } from "../db/schema";
import { setLive, pushLog } from "../lib/redis";
import { capturePage, screenshotUrl, type CaptureResult } from "../lib/browser";
import { captureWithFirecrawl, brandingBrief, firecrawlAvailable, type Branding } from "../lib/firecrawl";
import { analyzeWithVision, generateCode, fixCode } from "../lib/ai";
import { PreviewSession } from "../lib/sandbox";
import { runCodegenAgent, codegenAgentAvailable } from "../lib/codegenAgent";
import type { BuildReport } from "../db/schema";

const analysisSchema = z.object({
  summary: z.string().describe("One-paragraph summary of the page"),
  colors: z.array(z.object({ name: z.string(), value: z.string() })).describe("Key colors as name + hex"),
  fonts: z.array(z.string()).describe("Font families used"),
  components: z.array(
    z.object({
      name: z.string(),
      count: z.number().int(),
      confidence: z.number(),
    })
  ),
});
type AnalysisOut = z.infer<typeof analysisSchema>;

// Max number of automated fix passes when the build fails.
const MAX_FIX_ATTEMPTS = 2;

async function emit(runId: string, progress: number, stage: string, log?: string) {
  await setLive(runId, { progress, stage, status: "running" });
  if (log) await pushLog(runId, log);
  await db.update(runs).set({ progress, currentStage: stage }).where(eq(runs.id, runId));
}

function pickRoutes(links: string[], depth: RunConfig["depth"]): string[] {
  const uniq = Array.from(new Set(["/", ...links]));
  if (depth === "landing") return ["/"];
  if (depth === "top5") return uniq.slice(0, 5);
  return uniq.slice(0, 50);
}

/** Parse ```lang file=path fenced blocks from the codegen output. */
function parseGeneratedFiles(markdown: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const re = /```[a-zA-Z0-9]*\s+file=([^\s`]+)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    files.push({ path: m[1].trim(), content: m[2].replace(/\s+$/, "") + "\n" });
  }
  return files;
}

/** Merge Firecrawl branding into design tokens, falling back to vision analysis. */
function mergeTokens(analysis: AnalysisOut, branding?: Branding): DesignTokens {
  const tokens: DesignTokens = { colors: analysis.colors, fonts: analysis.fonts };
  if (!branding) return tokens;

  if (branding.colors) {
    const fromBranding = Object.entries(branding.colors)
      .filter(([, v]) => typeof v === "string" && /^#|rgb|hsl/.test(v as string))
      .map(([name, value]) => ({ name, value: value as string }));
    if (fromBranding.length) tokens.colors = fromBranding;
  }
  const fams = branding.typography?.fontFamilies;
  if (fams?.length) tokens.fonts = fams;

  const radii = branding.spacing?.borderRadius;
  if (radii) {
    const list =
      typeof radii === "string" ? [radii] : Array.isArray(radii) ? radii : Object.values(radii);
    tokens.radii = list.map(String).filter((v) => v && v !== "undefined");
  }
  if (branding.spacing?.baseUnit) tokens.spacingBase = String(branding.spacing.baseUnit);
  if (branding.components) {
    tokens.buttons = {
      primary: branding.components.buttonPrimary,
      secondary: branding.components.buttonSecondary,
    };
  }
  return tokens;
}

const STACK_LABEL: Record<RunConfig["stack"], string> = {
  react: "React + Tailwind CSS",
  next: "Next.js (App Router) + Tailwind CSS",
  html: "static HTML + CSS",
};

const GOAL_LABEL: Record<RunConfig["goal"], string> = {
  recreate: "Recreate the page as a high-fidelity match.",
  redesign: "Recreate the structure but modernize the visual layer.",
  rebrand: "Recreate the layout but swap palette, typography, and logo for a fresh brand.",
  saas: "Recreate the marketing page and add an authenticated dashboard shell.",
};

const CODEGEN_SYSTEM = (stack: RunConfig["stack"]) =>
  `You are an expert frontend engineer. You recreate web pages as clean, production-quality ` +
  `${STACK_LABEL[stack]} code. Output ONLY fenced code blocks, each tagged with its path ` +
  "like ```tsx file=src/App.tsx. The top-level component MUST be `export default` in src/App.tsx. " +
  "Make components self-contained and import siblings with relative paths. " +
  "Use Tailwind utility classes for all styling (a Tailwind runtime is present). " +
  "Do not import images or external assets; use inline SVG or solid colors. " +
  "lucide-react is available for icons, but only generic icons — its brand icons " +
  "(Github, Twitter, Linkedin, Facebook, etc.) were removed, so render brand marks " +
  "as inline SVG instead. Do not include explanatory prose outside the code blocks.";

/**
 * The real clone pipeline. Capture (Firecrawl) → analyze → generate → build &
 * serve in an e2b sandbox → auto-fix build errors → screenshot the running
 * clone. Progress reports to Redis (live) and Postgres (durable).
 */
export async function runPipeline(runId: string, url: string, config: RunConfig) {
  try {
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
    await setLive(runId, { status: "running", progress: 0, stage: "Starting" });
    await pushLog(runId, `[init] Run started for ${url}`);

    // 1. Capture + crawl --------------------------------------------------
    const useFirecrawl = firecrawlAvailable;
    await emit(
      runId,
      8,
      "Capturing screenshot",
      `[capture] ${useFirecrawl ? "Firecrawl scrape (screenshot + branding + links)" : "Headless Chromium"}`
    );

    let capture: CaptureResult;
    let branding: Branding | undefined;
    if (useFirecrawl) {
      try {
        const fc = await captureWithFirecrawl(url);
        capture = fc;
        branding = fc.branding;
        await pushLog(
          runId,
          `[firecrawl] Captured "${fc.title}" · ${fc.links.length} links · ${branding ? "design system extracted" : "no branding data"}`
        );
      } catch (e) {
        await pushLog(runId, `[firecrawl] Failed (${(e as Error).message}) — falling back to Browserless`);
        capture = await capturePage(url);
      }
    } else {
      capture = await capturePage(url);
    }

    await emit(
      runId,
      26,
      "Crawling routes",
      `[crawler] "${capture.title}" · ${capture.links.length} same-origin links`
    );
    const routes = pickRoutes(capture.links, config.depth);
    await pushLog(runId, `[crawler] Selected ${routes.length} route(s): ${routes.slice(0, 8).join(", ")}`);

    // 2. Analyze (vision) -------------------------------------------------
    await emit(runId, 38, "Mapping design tokens", `[vision] Analyzing layout + components`);
    const analysis: AnalysisOut = await analyzeWithVision({
      screenshotBase64: capture.screenshotBase64,
      schema: analysisSchema,
      prompt:
        `This is a screenshot of the web page at ${capture.finalUrl} (title: "${capture.title}"). ` +
        `Extract its design system and components. Return: a one-paragraph summary, the key colors ` +
        `(name + hex), the font families used, and the reusable UI components you can identify ` +
        `(name, approximate count on the page, and your confidence 0-1). ` +
        `Page text excerpt:\n${capture.text.slice(0, 4000)}`,
    });
    const tokens = mergeTokens(analysis, branding);
    const brief = brandingBrief(branding);
    await pushLog(
      runId,
      `[design] ${tokens.colors.length} colors · ${tokens.fonts.length} fonts · ${analysis.components.length} components` +
        (branding ? ` · branding enriched` : "")
    );

    // 3. Generate code ----------------------------------------------------
    await emit(runId, 52, "Generating code", `[codegen] Generating ${STACK_LABEL[config.stack]}`);
    const passList = Object.entries(config.opts)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const codeMd = await generateCode({
      screenshotBase64: capture.screenshotBase64,
      system: CODEGEN_SYSTEM(config.stack),
      prompt:
        `Recreate this page as ${STACK_LABEL[config.stack]}. Goal: ${GOAL_LABEL[config.goal]} ` +
        `Apply these passes where relevant: ${passList.join(", ") || "none"}. ` +
        `Use this extracted design system — colors: ${tokens.colors
          .map((c) => `${c.name} ${c.value}`)
          .join(", ")}; fonts: ${tokens.fonts.join(", ")}. ` +
        (brief ? `Brand details: ${brief}. ` : "") +
        `Detected components: ${analysis.components.map((c) => c.name).join(", ")}. ` +
        `Produce a top-level src/App.tsx (export default) plus a component file per major section. ` +
        `Keep it to real, compiling TSX.`,
    });
    let files = parseGeneratedFiles(codeMd);
    if (files.length === 0) files = [{ path: "src/App.tsx", content: codeMd }];
    await pushLog(runId, `[codegen] Wrote ${files.length} file(s): ${files.map((f) => f.path).join(", ")}`);

    // 4. Build + serve, with auto-fix passes ------------------------------
    // Preferred path: delegate the build→fix→preview loop to the standalone eve
    // codegen agent (durable, model-driven, unbounded fix passes). Fallback:
    // the in-process loop below. Either way one sandbox is reused across build
    // attempts, so deps install once and each pass only re-bundles.
    await emit(runId, 64, "Building & live preview", `[build] Spinning up sandbox + installing toolchain`);
    let build: BuildReport = { ran: false, passed: false, output: "E2B_API_KEY not set — build & preview skipped." };
    let previewUrl: string | null = null;
    let sandboxId: string | null = null;
    let fixAttempts = 0;
    let usedAgent = false;

    if (codegenAgentAvailable) {
      await emit(runId, 66, "Building & live preview", `[agent] Delegating build→fix→preview to codegen agent`);
      const agentResult = await runCodegenAgent({
        files,
        stack: config.stack,
        maxFixAttempts: MAX_FIX_ATTEMPTS,
        onLog: (line) => void pushLog(runId, line),
      });
      if (agentResult) {
        usedAgent = true;
        if (agentResult.files?.length) files = agentResult.files;
        build = agentResult.build;
        previewUrl = agentResult.previewUrl;
        sandboxId = agentResult.sandboxId;
        fixAttempts = agentResult.fixAttempts ?? 0;
        await pushLog(
          runId,
          `[agent] ${build.passed ? "Bundle OK" : "Build failed"} after ${fixAttempts} fix pass(es)` +
            (previewUrl ? ` · preview live at ${previewUrl}` : "")
        );
      } else {
        await pushLog(runId, `[agent] Unavailable or errored — falling back to in-process build`);
      }
    }

    if (!usedAgent) {
      let session: PreviewSession | null = null;
      try {
        session = await PreviewSession.open();
      } catch (e) {
        build = { ran: true, passed: false, output: (e as Error).message };
        await pushLog(runId, `[build] ${build.output}`);
      }

      if (session) {
        try {
          await emit(runId, 68, "Building & live preview", `[build] Bundling with esbuild`);
          build = await session.build(files);
          if (!build.passed) {
            await pushLog(runId, `[build] Failed:\n${build.output.slice(0, 600)}`);
          }
          while (!build.passed && fixAttempts < MAX_FIX_ATTEMPTS) {
            fixAttempts += 1;
            await emit(
              runId,
              70 + fixAttempts * 3,
              `Building & live preview (fix pass ${fixAttempts})`,
              `[fix] Build failed — feeding errors back to the model (attempt ${fixAttempts}/${MAX_FIX_ATTEMPTS})`
            );
            const fixedMd = await fixCode({ files, errors: build.output, system: CODEGEN_SYSTEM(config.stack) });
            const fixed = parseGeneratedFiles(fixedMd);
            if (fixed.length > 0) files = fixed;
            build = await session.build(files);
            if (!build.passed) await pushLog(runId, `[fix] Still failing:\n${build.output.slice(0, 400)}`);
          }

          if (build.passed) {
            await emit(runId, 84, "Building & live preview", `[build] Serving live preview`);
            previewUrl = await session.serve();
            sandboxId = session.sandboxId;
          } else {
            await session.close();
          }
        } catch (e) {
          build = { ran: true, passed: false, output: `Sandbox error: ${(e as Error).message}` };
          await session.close();
          await pushLog(runId, `[build] ${build.output}`);
        }
      }
    }

    await pushLog(
      runId,
      build.ran
        ? `[build] ${build.passed ? "Bundle OK" : "Build still failing"} after ${fixAttempts} fix pass(es)` +
            (previewUrl ? ` · preview live at ${previewUrl}` : "")
        : `[build] skipped (${build.output})`
    );

    // 5. Screenshot the running clone -------------------------------------
    let renderedScreenshotDataUrl: string | undefined;
    if (previewUrl) {
      await emit(runId, 88, "Rendering clone preview", `[render] Screenshotting the running app`);
      try {
        const shot = await screenshotUrl(previewUrl);
        renderedScreenshotDataUrl = `data:image/png;base64,${shot}`;
        await pushLog(runId, `[render] Captured rendered clone`);
      } catch (e) {
        await pushLog(runId, `[render] Could not screenshot preview (${(e as Error).message})`);
      }
    }

    // 6. Persist ----------------------------------------------------------
    await emit(runId, 96, "Comparing visual accuracy", `[diff] Finalizing result`);
    const result: RunResult = {
      title: capture.title || url,
      summary: analysis.summary,
      routes,
      tokens,
      components: analysis.components,
      files,
      build,
      fixAttempts,
      screenshotDataUrl: `data:image/png;base64,${capture.screenshotBase64}`,
      renderedScreenshotDataUrl,
      previewUrl,
      sandboxId,
    };

    await db
      .update(runs)
      .set({ status: "succeeded", progress: 100, currentStage: "Done", result, finishedAt: new Date() })
      .where(eq(runs.id, runId));
    await setLive(runId, { status: "succeeded", progress: 100, stage: "Done" });
    await pushLog(runId, `[done] Clone complete`);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    await db
      .update(runs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(runs.id, runId));
    await setLive(runId, { status: "failed", stage: "Failed" });
    await pushLog(runId, `[error] ${message}`);
  }
}
