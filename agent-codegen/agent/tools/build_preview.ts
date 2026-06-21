import { defineTool } from "eve/tools";
import { z } from "zod";
import { getPreviewSession } from "../lib/preview";

// The one tool the codegen loop drives. The model submits the current file set;
// the tool bundles it with esbuild in a reused e2b sandbox and, on success,
// serves a live preview. On failure it returns the esbuild errors verbatim so
// the model can fix the files and call again. Reusing the sandbox across calls
// (keyed by the eve session id) means the toolchain installs only once.

const fileSchema = z.object({
  path: z.string().min(1).describe('Project-relative path, e.g. "src/App.tsx".'),
  content: z.string().describe("Full file contents."),
});

export default defineTool({
  description:
    "Bundle the current set of generated project files with esbuild in a sandbox " +
    "and, if the build succeeds, serve a live preview. Returns { passed, output, " +
    "previewUrl }. When passed is false, `output` contains the esbuild errors — fix " +
    "the files and call this tool again. Reuses one sandbox across calls in a session, " +
    "so repeated calls are fast. The top-level component must be `export default` in " +
    "src/App.tsx; an entry (src/main.tsx) is synthesized if you don't provide one.",
  inputSchema: z.object({
    files: z.array(fileSchema).min(1).describe("The complete current project file set."),
  }),
  outputSchema: z.object({
    ran: z.boolean().describe("False only when no sandbox is available (E2B unset)."),
    passed: z.boolean(),
    output: z.string().describe("esbuild output: error text on failure, a status line on success."),
    previewUrl: z.string().nullable().describe("Public URL of the running preview when passed."),
    sandboxId: z.string().nullable(),
  }),
  async execute({ files }, ctx) {
    const sessionId = ctx.session.id;
    const session = await getPreviewSession(sessionId);

    if (!session) {
      return {
        ran: false,
        passed: false,
        output: "E2B_API_KEY not set — build & preview skipped. Return the files as-is.",
        previewUrl: null,
        sandboxId: null,
      };
    }

    const build = await session.build(files);
    if (!build.passed) {
      return { ran: true, passed: false, output: build.output, previewUrl: null, sandboxId: null };
    }

    const previewUrl = await session.serve();
    return {
      ran: true,
      passed: true,
      output: build.output,
      previewUrl,
      sandboxId: session.sandboxId,
    };
  },
});
