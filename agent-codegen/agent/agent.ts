import { defineAgent } from "eve";
import { z } from "zod";

// The structured result the codegen loop returns to the caller (the Hono
// pipeline). The pipeline also passes this same schema per-request, which is
// what makes an interactive turn produce structured output; declaring it here
// documents the contract and covers task-mode (subagent/schedule) runs.
export const codegenResult = z.object({
  files: z
    .array(z.object({ path: z.string(), content: z.string() }))
    .describe("The final project files — exactly the set from the last successful build_preview call."),
  build: z.object({
    ran: z.boolean(),
    passed: z.boolean(),
    output: z.string(),
  }),
  previewUrl: z.string().nullable().describe("Public preview URL, or null if the build never passed."),
  sandboxId: z.string().nullable(),
  fixAttempts: z.number().int().describe("How many build→fix passes were needed (0 if it built first try)."),
});

export default defineAgent({
  // Gateway-routed: authenticates via AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN,
  // mirroring the main app's GATEWAY_CODEGEN_MODEL.
  model: process.env.GATEWAY_CODEGEN_MODEL ?? "anthropic/claude-opus-4.8",
  outputSchema: codegenResult,
});
