import { env } from "../env";
import type { GeneratedFile, BuildReport } from "../db/schema";

// Thin HTTP client for the standalone eve codegen agent (the `agent-codegen`
// package). We talk to its stable eve channel over plain fetch rather than
// importing `eve/client`, so the main app's dependency tree stays untouched
// (eve requires ai v7-beta / React 19 as peers — see agent-codegen/README.md).
//
// Wire contract (see eve docs: Sessions, runs & streaming):
//   POST /eve/v1/session            { message, outputSchema } -> { sessionId, continuationToken }
//   GET  /eve/v1/session/:id/stream NDJSON; the structured result arrives on a
//                                   `result.completed` event as `data.result`.

export type CodegenAgentResult = {
  files: GeneratedFile[];
  build: BuildReport;
  previewUrl: string | null;
  sandboxId: string | null;
  fixAttempts: number;
};

// Plain draft-07 JSON Schema describing CodegenAgentResult. The eve channel
// accepts a raw JSON Schema for a turn's outputSchema (it only needs a JSON
// object; Standard Schemas are converted to this same shape server-side).
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["files", "build", "previewUrl", "sandboxId", "fixAttempts"],
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: { path: { type: "string" }, content: { type: "string" } },
      },
    },
    build: {
      type: "object",
      additionalProperties: false,
      required: ["ran", "passed", "output"],
      properties: {
        ran: { type: "boolean" },
        passed: { type: "boolean" },
        output: { type: "string" },
      },
    },
    previewUrl: { type: ["string", "null"] },
    sandboxId: { type: ["string", "null"] },
    fixAttempts: { type: "integer" },
  },
} as const;

const STACK_LABEL = {
  react: "React + Tailwind CSS",
  next: "Next.js (App Router) + Tailwind CSS",
  html: "static HTML + CSS",
} as const;

export type CodegenAgentInput = {
  files: GeneratedFile[];
  stack: keyof typeof STACK_LABEL;
  maxFixAttempts?: number;
  /** Called with human-readable progress lines as the agent streams. */
  onLog?: (line: string) => void;
  /** Overall budget for the agent turn (install + N build passes). */
  timeoutMs?: number;
};

/** True when a codegen agent URL is configured. */
export const codegenAgentAvailable = Boolean(env.CODEGEN_AGENT_URL);

function filesToBlocks(files: GeneratedFile[]): string {
  return files
    .map((f) => "```tsx file=" + f.path + "\n" + f.content + "\n```")
    .join("\n\n");
}

function buildMessage(input: CodegenAgentInput): string {
  const maxAttempts = input.maxFixAttempts ?? 6;
  return (
    `Get this generated ${STACK_LABEL[input.stack]} project to build cleanly and serve a ` +
    `live preview, then return the final files. Use up to ${maxAttempts} build→fix ` +
    `attempts.\n\n` +
    `--- CURRENT FILES ---\n${filesToBlocks(input.files)}`
  );
}

/**
 * Run the generate→build→fix→preview loop on the standalone eve agent. Returns
 * the structured result, or `null` when no agent is configured or the call
 * fails — callers should fall back to the in-process loop in that case.
 */
export async function runCodegenAgent(
  input: CodegenAgentInput
): Promise<CodegenAgentResult | null> {
  const base = env.CODEGEN_AGENT_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 10 * 60_000);

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.CODEGEN_AGENT_TOKEN) headers.authorization = `Bearer ${env.CODEGEN_AGENT_TOKEN}`;

    const createRes = await fetch(`${base}/eve/v1/session`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: buildMessage(input), outputSchema: OUTPUT_SCHEMA }),
      signal: controller.signal,
    });
    if (!createRes.ok) {
      input.onLog?.(`[agent] create session failed: ${createRes.status} ${await safeText(createRes)}`);
      return null;
    }
    const created = (await createRes.json()) as { sessionId?: string };
    const sessionId =
      created.sessionId ?? createRes.headers.get("x-eve-session-id")?.trim();
    if (!sessionId) {
      input.onLog?.("[agent] no session id returned");
      return null;
    }

    const streamRes = await fetch(
      `${base}/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`,
      { headers: env.CODEGEN_AGENT_TOKEN ? { authorization: headers.authorization } : undefined, signal: controller.signal }
    );
    if (!streamRes.ok || !streamRes.body) {
      input.onLog?.(`[agent] stream failed: ${streamRes.status}`);
      return null;
    }

    let result: CodegenAgentResult | null = null;
    for await (const event of readNdjson(streamRes.body)) {
      switch (event.type) {
        case "action.result": {
          // Surface each build_preview pass to the run log.
          const out = event.data?.result ?? event.data?.output;
          if (out && typeof out === "object" && "passed" in out) {
            const passed = (out as { passed?: boolean }).passed;
            input.onLog?.(`[agent] build_preview → ${passed ? "passed" : "failed"}`);
          }
          break;
        }
        case "result.completed":
          result = event.data?.result as CodegenAgentResult;
          break;
        case "turn.failed":
        case "session.failed":
          input.onLog?.(`[agent] ${event.type}: ${event.data?.message ?? "unknown error"}`);
          break;
      }
      if (
        event.type === "turn.completed" ||
        event.type === "session.completed" ||
        event.type === "turn.failed" ||
        event.type === "session.failed"
      ) {
        break;
      }
    }
    return result;
  } catch (err) {
    input.onLog?.(`[agent] error: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}

type EveEvent = { type: string; data?: any };

/** Parse an NDJSON byte stream into events, one per line. */
async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<EveEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as EveEvent;
        } catch {
          /* ignore non-JSON keepalive lines */
        }
      }
    }
    const tail = buffer.trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as EveEvent;
      } catch {
        /* ignore */
      }
    }
  } finally {
    reader.releaseLock();
  }
}
