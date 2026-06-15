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
