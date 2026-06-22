import { env } from "../env";
import type { CaptureResult } from "./browser";

/**
 * Firecrawl's `branding` format — a structured design system extracted from the
 * page (colors, typography, spacing, component styles). Shapes are best-effort:
 * Firecrawl fills what it can, so every field is optional.
 */
export type Branding = {
  colorScheme?: "light" | "dark";
  logo?: string;
  colors?: Record<string, string>;
  fonts?: unknown[];
  typography?: {
    fontFamilies?: string[];
    fontSizes?: Record<string, string> | string[];
    fontWeights?: Record<string, string | number> | (string | number)[];
    lineHeights?: Record<string, string | number> | (string | number)[];
  };
  spacing?: {
    baseUnit?: string | number;
    borderRadius?: Record<string, string> | string[] | string;
    padding?: unknown;
    margins?: unknown;
  };
  components?: {
    buttonPrimary?: Record<string, string>;
    buttonSecondary?: Record<string, string>;
    input?: Record<string, string>;
    [k: string]: unknown;
  };
  personality?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

export type FirecrawlCapture = CaptureResult & {
  markdown: string;
  branding?: Branding;
  screenshotUrl?: string;
};

export const firecrawlAvailable = !!env.FIRECRAWL_API_KEY;

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch screenshot (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

/**
 * Scrape a page with Firecrawl in a single request: a viewport screenshot, the
 * extracted brand/design system, same-origin links, and markdown. Firecrawl
 * handles JS rendering and anti-bot, and the `branding` format gives a far
 * richer design system than vision-only inference.
 */
export async function captureWithFirecrawl(url: string): Promise<FirecrawlCapture> {
  if (!env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not set");

  const res = await fetch(`${env.FIRECRAWL_API_URL.replace(/\/$/, "")}/scrape`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      // Let lazy backgrounds, hero images and webfonts settle, then scroll so
      // lazy section backgrounds load before the shot.
      waitFor: 3000,
      actions: [
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 1200 },
        { type: "scroll", direction: "up" },
        { type: "wait", milliseconds: 500 },
      ],
      formats: [
        "markdown",
        "links",
        "branding",
        // Capture at a real 1440×900 viewport. The pipeline re-shoots the visual
        // reference with our own normal-viewport headless capture (see run.ts),
        // so this screenshot is only a fallback — a tall synthetic viewport here
        // inflated every vh-based size and gave the model the wrong proportions.
        { type: "screenshot", fullPage: false, viewport: { width: 1440, height: 900 } },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl scrape failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      markdown?: string;
      links?: string[];
      branding?: Branding;
      screenshot?: string;
      metadata?: { title?: string; sourceURL?: string; url?: string };
    };
    error?: string;
  };

  if (!json.success || !json.data) {
    throw new Error(`Firecrawl scrape failed: ${json.error ?? "no data"}`);
  }

  const data = json.data;
  const finalUrl = data.metadata?.sourceURL || data.metadata?.url || url;
  const origin = new URL(finalUrl).origin;

  // Reduce the link list to same-origin pathnames, matching the crawler's needs.
  const paths = new Set<string>();
  for (const link of data.links ?? []) {
    try {
      const u = new URL(link, finalUrl);
      if (u.origin === origin) paths.add(u.pathname);
    } catch {
      /* ignore */
    }
  }

  const screenshotUrl = data.screenshot;
  const screenshotBase64 = screenshotUrl ? await urlToBase64(screenshotUrl) : "";
  if (!screenshotBase64) throw new Error("Firecrawl returned no screenshot");

  return {
    title: data.metadata?.title ?? "",
    finalUrl,
    screenshotBase64,
    screenshotUrl,
    html: "",
    text: data.markdown ?? "",
    markdown: data.markdown ?? "",
    links: Array.from(paths),
    branding: data.branding,
  };
}

/** Flatten Firecrawl branding into a compact, prompt-friendly design-system brief. */
export function brandingBrief(branding?: Branding): string {
  if (!branding) return "";
  const parts: string[] = [];
  if (branding.colorScheme) parts.push(`scheme: ${branding.colorScheme}`);
  if (branding.colors) {
    const cols = Object.entries(branding.colors)
      .filter(([, v]) => typeof v === "string" && v)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (cols) parts.push(`colors → ${cols}`);
  }
  const fams = branding.typography?.fontFamilies;
  if (fams?.length) parts.push(`fonts → ${fams.join(", ")}`);
  const radii = branding.spacing?.borderRadius;
  if (radii) {
    const r = Array.isArray(radii) ? radii.join(", ") : Object.values(radii).join(", ");
    if (r) parts.push(`radii → ${r}`);
  }
  if (branding.spacing?.baseUnit) parts.push(`spacing base → ${branding.spacing.baseUnit}`);
  const btn = branding.components?.buttonPrimary;
  if (btn) {
    const desc = Object.entries(btn)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    if (desc) parts.push(`primary button → ${desc}`);
  }
  return parts.join("; ");
}
