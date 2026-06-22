import { z } from "zod";
import type { GeneratedFile, BuildReport, FidelityReport, VisualDifference } from "../db/schema";
import { judgeVisualDifferences, fixVisualFidelity } from "./ai";
import { computePixelDiff, fidelityScore } from "./visualDiff";
import { screenshotUrl } from "./browser";
import { parseGeneratedFiles } from "./codegenFiles";

// How many judge→fix→rebuild passes to attempt, and the fidelity score (0..100)
// at which the clone is "close enough" and we stop refining.
export const MAX_FIDELITY_PASSES = 2;
export const FIDELITY_TARGET_SCORE = 92;

// The vision judge returns a ranked list of concrete visual differences.
export const fidelityJudgeSchema = z.object({
  differences: z
    .array(
      z.object({
        area: z.string().describe('Where on the page, e.g. "hero", "navbar", "pricing cards", "footer"'),
        issue: z.string().describe("Concrete, actionable description of what is wrong in the clone"),
        severity: z.enum(["high", "medium", "low"]),
      })
    )
    .describe("Most important visual differences, highest severity first. Empty if the clone already matches."),
});

export const FIDELITY_JUDGE_PROMPT =
  "Compare the CLONE to the ORIGINAL as a meticulous design reviewer. List the most " +
  "important visual differences someone would have to fix to make the clone match the " +
  "original — covering layout & section order, spacing & proportions, colors, typography " +
  "(family/size/weight), and any missing or extra UI. Be specific about WHERE and WHAT. " +
  "If the two already match closely, return an empty list.";

/** The minimal session surface the loop needs: re-bundle a file set in place. */
export interface RebuildableSession {
  build(files: GeneratedFile[]): Promise<BuildReport>;
}

export type FidelityLoopParams = {
  session: RebuildableSession;
  files: GeneratedFile[];
  originalScreenshotBase64: string;
  renderedScreenshotBase64: string;
  /** Stable preview URL; we re-screenshot it after each rebuild. */
  previewUrl: string;
  /** Ground-truth design spec (from extract.buildDesignSpec) to anchor fixes. */
  designSpec: string;
  /** The codegen system prompt (same one used for initial generation). */
  system: string;
  /** Progress reporter (wired to the pipeline's emit). */
  emit?: (progress: number, stage: string, log?: string) => Promise<void> | void;
  /** Log line reporter (wired to the pipeline's pushLog). */
  log?: (line: string) => Promise<void> | void;
};

export type FidelityLoopResult = {
  fidelity: FidelityReport;
  files: GeneratedFile[];
  renderedScreenshotBase64: string;
};

/**
 * Visual-fidelity refinement loop. With the clone live in a (re-buildable)
 * session, repeatedly: diff the render against the original (pixels) + judge it
 * (vision) → feed the concrete differences back to the model → rebuild → re-
 * screenshot → re-measure, until the clone is close enough or we run out of
 * passes. Only rebuilds that still compile are accepted, so a bad fix pass can
 * never regress a working clone.
 *
 * `session.build()` rewrites public/bundle.js in place; the already-running
 * preview server picks it up on the next request, so each pass only re-bundles
 * and re-screenshots — no re-serve, and the previewUrl stays stable.
 */
export async function runFidelityLoop(params: FidelityLoopParams): Promise<FidelityLoopResult> {
  const { session, originalScreenshotBase64, previewUrl, designSpec, system } = params;
  const log = async (line: string) => {
    await params.log?.(line);
  };
  let files = params.files;
  let renderedScreenshotBase64 = params.renderedScreenshotBase64;
  let passes = 0;

  let diff = computePixelDiff(originalScreenshotBase64, renderedScreenshotBase64);
  let score = fidelityScore(diff.mismatch);
  let differences: VisualDifference[] = [];
  await log(`[fidelity] Initial pixel match ${score}/100 (${(diff.mismatch * 100).toFixed(1)}% of pixels differ)`);

  while (passes < MAX_FIDELITY_PASSES && score < FIDELITY_TARGET_SCORE) {
    // Perceptual pass — what a designer would call out.
    const judged = await judgeVisualDifferences({
      originalBase64: originalScreenshotBase64,
      renderedBase64: renderedScreenshotBase64,
      schema: fidelityJudgeSchema,
      prompt: FIDELITY_JUDGE_PROMPT,
    });
    differences = judged.differences;
    if (differences.length === 0) {
      await log(`[fidelity] Judge found no further differences — done`);
      break;
    }

    // `passes` counts *accepted* refinements; this attempt only becomes one if
    // its rebuild compiles. Each non-accepting branch below breaks the loop, so
    // the loop still terminates without a separate attempt counter.
    const attemptNo = passes + 1;
    await params.emit?.(
      Math.min(94, 88 + attemptNo * 2),
      `Refining visual fidelity (pass ${attemptNo})`,
      `[fidelity] Pass ${attemptNo}/${MAX_FIDELITY_PASSES}: ${differences.length} difference(s), score ${score}/100 — regenerating`
    );

    const diffText = differences
      .map((d, i) => `${i + 1}. [${d.severity}] ${d.area}: ${d.issue}`)
      .join("\n");
    const fixedMd = await fixVisualFidelity({
      files,
      differences: diffText,
      designSpec,
      system,
      originalBase64: originalScreenshotBase64,
      renderedBase64: renderedScreenshotBase64,
    });
    const fixed = parseGeneratedFiles(fixedMd);
    if (fixed.length === 0) {
      await log(`[fidelity] Pass ${attemptNo} produced no parseable files — keeping previous version`);
      break;
    }

    // Only accept a rebuild that still compiles, so fidelity work never breaks
    // a working clone.
    const rebuild = await session.build(fixed);
    if (!rebuild.passed) {
      await log(`[fidelity] Pass ${attemptNo} broke the build — discarding, keeping previous version`);
      break;
    }
    files = fixed;
    passes = attemptNo;

    renderedScreenshotBase64 = await screenshotUrl(previewUrl);
    diff = computePixelDiff(originalScreenshotBase64, renderedScreenshotBase64);
    const newScore = fidelityScore(diff.mismatch);
    await log(`[fidelity] Pass ${attemptNo} → pixel match ${score}/100 → ${newScore}/100`);
    score = newScore;
  }

  const fidelity: FidelityReport = {
    pixelMismatch: diff.mismatch,
    score,
    differences,
    passes,
    diffImageDataUrl: diff.diffPngBase64 ? `data:image/png;base64,${diff.diffPngBase64}` : undefined,
  };
  return { fidelity, files, renderedScreenshotBase64 };
}
