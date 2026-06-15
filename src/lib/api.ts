// Thin client for the CloneCraft API (proxied to the Hono server in dev).
//
// In dev, /api/* is reverse-proxied by Vite to the Hono server on :8787.
// In production, the frontend is on Vercel and the API is on Fly — they are
// different origins, so we MUST send cookies cross-origin. `credentials:
// "include"` does that for the Clerk session cookie.

const BASE = import.meta.env.VITE_API_BASE_URL || "";

export type RunConfig = {
  url: string;
  depth: "landing" | "top5" | "full";
  stack: "react" | "next" | "html";
  goal: "recreate" | "redesign" | "rebrand" | "saas";
  opts: Record<string, boolean>;
};

export type DetectedComponent = { name: string; count: number; confidence: number };

export type DesignTokens = {
  colors: { name: string; value: string }[];
  fonts: string[];
  radii?: string[];
  spacingBase?: string;
  buttons?: { primary?: Record<string, string>; secondary?: Record<string, string> };
};

export type RunResult = {
  title: string;
  summary: string;
  routes: string[];
  tokens: DesignTokens;
  components: DetectedComponent[];
  files: { path: string; content: string }[];
  build: { ran: boolean; passed: boolean; output: string };
  fixAttempts?: number;
  screenshotDataUrl?: string;
  renderedScreenshotDataUrl?: string;
  previewUrl?: string | null;
  sandboxId?: string | null;
};

export type RunStatus = {
  id: string;
  url: string;
  config: RunConfig;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  stage: string;
  logs: string[];
  error: string | null;
  result: RunResult | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  latestRun: {
    id: string;
    status: string;
    progress: number;
    accuracy: number | null;
    pages: number | null;
    components: number | null;
  } | null;
};

export type Me = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createRun(config: RunConfig) {
  return http<{ id: string; projectId: string; status: string }>("/api/runs", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export function getRun(id: string) {
  return http<RunStatus>(`/api/runs/${id}`);
}

/** (Re)launch a live preview sandbox for a finished run. */
export function relaunchPreview(id: string) {
  return http<{ previewUrl: string; renderedScreenshotDataUrl?: string }>(
    `/api/runs/${id}/preview`,
    { method: "POST" }
  );
}

export function listProjects() {
  return http<ProjectSummary[]>("/api/projects");
}

export function getMe() {
  return http<Me>("/api/me");
}
