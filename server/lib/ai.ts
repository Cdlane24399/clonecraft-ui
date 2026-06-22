import { generateObject, streamText } from "ai";
import type { z } from "zod";
import { env } from "../env";

// All model calls route through the Vercel AI Gateway. Models are plain
// "provider/model" slugs — the `ai` SDK routes them through the gateway
// automatically, authenticating via AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN.
export const MODELS = {
  codegen: env.GATEWAY_CODEGEN_MODEL,
  vision: env.GATEWAY_VISION_MODEL,
};

/** Vision + text → object validated against a Zod schema (structured output). */
export async function analyzeWithVision<T>(args: {
  screenshotBase64: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const { object } = await generateObject({
    model: MODELS.vision,
    schema: args.schema,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: Buffer.from(args.screenshotBase64, "base64") },
          { type: "text", text: args.prompt },
        ],
      },
    ],
  });
  return object;
}

/** Generate code from a screenshot + prompt. Streams, returns the full text. */
export async function generateCode(args: {
  screenshotBase64: string;
  prompt: string;
  system: string;
}): Promise<string> {
  const result = streamText({
    model: MODELS.codegen,
    system: args.system,
    maxOutputTokens: 32000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: Buffer.from(args.screenshotBase64, "base64") },
          { type: "text", text: args.prompt },
        ],
      },
    ],
  });
  return await result.text;
}

/**
 * Visual judge. Shows the model the ORIGINAL page and the rendered CLONE side by
 * side and asks it to enumerate the concrete visual differences, validated
 * against a Zod schema. This is the perceptual half of the fidelity loop (the
 * other half is the pixel diff) — it catches what a mismatch percentage can't
 * describe: "the hero font is too small", "the nav is missing its CTA".
 */
export async function judgeVisualDifferences<T>(args: {
  originalBase64: string;
  renderedBase64: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const { object } = await generateObject({
    model: MODELS.vision,
    schema: args.schema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "ORIGINAL — the target page the clone must match:" },
          { type: "image", image: Buffer.from(args.originalBase64, "base64") },
          { type: "text", text: "CLONE — how the generated clone currently renders:" },
          { type: "image", image: Buffer.from(args.renderedBase64, "base64") },
          { type: "text", text: args.prompt },
        ],
      },
    ],
  });
  return object;
}

/**
 * Fidelity repair. Unlike `fixCode` (which fixes *build* errors), this fixes
 * *visual* gaps: the model sees the original, the current clone render, the
 * ranked differences, and the measured design system, and returns a corrected,
 * complete set of files that should render closer to the target.
 */
export async function fixVisualFidelity(args: {
  files: { path: string; content: string }[];
  differences: string;
  designSpec: string;
  system: string;
  originalBase64: string;
  renderedBase64: string;
}): Promise<string> {
  const filesBlock = args.files
    .map((f) => "```tsx file=" + f.path + "\n" + f.content + "\n```")
    .join("\n\n");

  const result = streamText({
    model: MODELS.codegen,
    system: args.system,
    maxOutputTokens: 32000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "TARGET — the original page the clone must match pixel-for-pixel:" },
          { type: "image", image: Buffer.from(args.originalBase64, "base64") },
          { type: "text", text: "CURRENT — how your clone renders right now (it is not close enough):" },
          { type: "image", image: Buffer.from(args.renderedBase64, "base64") },
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
  return await result.text;
}

/**
 * Repair a failed build. Given the current files and the build error output,
 * the model returns a corrected, complete set of fenced `file=` blocks.
 */
export async function fixCode(args: {
  files: { path: string; content: string }[];
  errors: string;
  system: string;
}): Promise<string> {
  const filesBlock = args.files
    .map((f) => "```tsx file=" + f.path + "\n" + f.content + "\n```")
    .join("\n\n");

  const result = streamText({
    model: MODELS.codegen,
    system: args.system,
    maxOutputTokens: 32000,
    messages: [
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
  return await result.text;
}
