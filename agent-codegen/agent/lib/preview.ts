import { Sandbox } from "e2b";
import type { GeneratedFile, BuildReport } from "./types";

// Ported from the main app's server/lib/sandbox.ts. The build runs in e2b
// (an authored eve tool, so it executes in the app runtime with full
// process.env — not inside eve's own sandbox). One PreviewSession is reused
// across every build attempt in a single eve session, so the npm install only
// happens once and each fix pass just re-bundles (seconds, not minutes).

const APP_ROOT = "/home/user/app";
const PREVIEW_PORT = 3000;

const E2B_API_KEY = process.env.E2B_API_KEY;
const E2B_TEMPLATE = process.env.E2B_TEMPLATE ?? "base";
const PREVIEW_TIMEOUT_MS = Number(process.env.PREVIEW_TIMEOUT_MS ?? 15 * 60 * 1000);

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CloneCraft preview</title>
    <!-- Tailwind CDN JIT-compiles arbitrary utility classes at runtime, so the
         generated Tailwind markup renders without a build-time Tailwind config. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/bundle.js"></script>
  </body>
</html>
`;

const MAIN_TSX = `import { createRoot } from "react-dom/client";
import App from "./App";

const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
`;

function entryFile(files: GeneratedFile[]): string {
  const entry = files.find((f) => /src\/(main|index|entry)\.(t|j)sx?$/.test(f.path));
  return entry ? entry.path : "src/main.tsx";
}

export class PreviewSession {
  private served = false;
  private previewUrl: string | null = null;

  private constructor(private sandbox: Sandbox) {}

  /** Create a sandbox and install the toolchain once. Returns null if E2B is unset. */
  static async open(): Promise<PreviewSession | null> {
    if (!E2B_API_KEY) return null;
    const sandbox = await Sandbox.create(E2B_TEMPLATE, {
      apiKey: E2B_API_KEY,
      timeoutMs: PREVIEW_TIMEOUT_MS,
    });
    await sandbox.commands.run(`mkdir -p ${APP_ROOT}/src ${APP_ROOT}/public`);
    await sandbox.files.write(`${APP_ROOT}/public/index.html`, INDEX_HTML);
    // Pin to the versions the app (and the model) expect. In particular,
    // lucide-react dropped brand icons (Github, Twitter, …) in newer releases,
    // so an unpinned install breaks codegen that imports them — pin to the
    // app's lucide-react, which still ships those icons.
    const install = await sandbox.commands.run(
      `cd ${APP_ROOT} && npm init -y >/dev/null 2>&1 && ` +
        `npm install --no-audit --no-fund react@^18.3.1 react-dom@^18.3.1 lucide-react@^0.462.0 esbuild >/dev/null 2>&1; ` +
        `echo __installed__`,
      { timeoutMs: 300_000 }
    );
    if (!install.stdout.includes("__installed__")) {
      await sandbox.kill().catch(() => {});
      throw new Error("Failed to install dependencies in sandbox.");
    }
    return new PreviewSession(sandbox);
  }

  get sandboxId(): string {
    return this.sandbox.sandboxId;
  }

  /** Write the current files and bundle them with esbuild. Fast (no install). */
  async build(files: GeneratedFile[]): Promise<BuildReport> {
    // Clear previous sources so renamed/removed files don't linger between passes.
    await this.sandbox.commands.run(`rm -rf ${APP_ROOT}/src && mkdir -p ${APP_ROOT}/src`);
    for (const f of files) {
      const dest = `${APP_ROOT}/${f.path}`.replace(/\/+/g, "/");
      const dir = dest.slice(0, dest.lastIndexOf("/"));
      await this.sandbox.commands.run(`mkdir -p ${dir}`);
      await this.sandbox.files.write(dest, f.content);
    }
    const hasEntry = files.some((f) => /src\/(main|index|entry)\.(t|j)sx?$/.test(f.path));
    if (!hasEntry) await this.sandbox.files.write(`${APP_ROOT}/src/main.tsx`, MAIN_TSX);

    // esbuild exits non-zero on build errors, which `commands.run` turns into a
    // thrown CommandExitError. Capture the real exit code with a trailing marker
    // (and merge stderr→stdout) so a failed build returns a report we can feed to
    // the fix loop instead of throwing out of it.
    const bundle = await this.sandbox.commands.run(
      `cd ${APP_ROOT} && (npx esbuild ${entryFile(files)} --bundle --outfile=public/bundle.js ` +
        `--jsx=automatic --loader:.js=jsx --define:process.env.NODE_ENV='"production"' --log-level=warning 2>&1; ` +
        `echo "__ESBUILD_EXIT__$?")`,
      { timeoutMs: 120_000 }
    );
    const match = bundle.stdout.match(/__ESBUILD_EXIT__(\d+)\s*$/);
    const code = match ? Number(match[1]) : bundle.exitCode;
    const passed = code === 0;
    const output =
      bundle.stdout.replace(/__ESBUILD_EXIT__\d+\s*$/, "").trim() ||
      (passed ? "Bundled successfully — 0 errors." : "esbuild failed.");
    return { ran: true, passed, output: output.slice(0, 8000) };
  }

  /** Serve the built bundle and return its public URL (idempotent per session). */
  async serve(): Promise<string> {
    if (this.served && this.previewUrl) return this.previewUrl;
    await this.sandbox.commands.run(
      `cd ${APP_ROOT}/public && nohup python3 -m http.server ${PREVIEW_PORT} >/tmp/serve.log 2>&1 &`,
      { background: true }
    );
    const previewUrl = `https://${this.sandbox.getHost(PREVIEW_PORT)}`;
    await waitForUrl(previewUrl);
    this.served = true;
    this.previewUrl = previewUrl;
    return previewUrl;
  }

  async close(): Promise<void> {
    await this.sandbox.kill().catch(() => {});
  }
}

/** Poll a URL until it responds (or timeout), so screenshots don't race the server. */
async function waitForUrl(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 750));
  }
}

// ── Per-eve-session sandbox cache ────────────────────────────────────────
// build_preview is called multiple times within one eve session (one per fix
// pass). We keep the live PreviewSession keyed by the eve session id so all
// passes share one sandbox and pay the npm install only once.

const sessions = new Map<string, PreviewSession>();

/** Sessions where E2B is unset; cached so we don't retry Sandbox.create per pass. */
const unavailable = new Set<string>();

export async function getPreviewSession(
  sessionId: string
): Promise<PreviewSession | null> {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  if (unavailable.has(sessionId)) return null;

  const session = await PreviewSession.open();
  if (!session) {
    unavailable.add(sessionId);
    return null;
  }
  sessions.set(sessionId, session);
  return session;
}

/** Drop (and kill) a session's sandbox — used when the build is abandoned. */
export async function closePreviewSession(sessionId: string): Promise<void> {
  const existing = sessions.get(sessionId);
  if (existing) {
    sessions.delete(sessionId);
    await existing.close();
  }
}
