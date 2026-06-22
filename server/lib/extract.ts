import puppeteer from "puppeteer-core";
import { env } from "../env";
import type { ExtractedDesign } from "../db/schema";
import { autoScroll, browserlessEndpoint } from "./browser";

/**
 * Ground-truth design extraction from a live page's *computed styles*.
 *
 * The flow is split into three pieces so the hard part is testable without a
 * browser:
 *   - `collectRawStyles(page)` walks the DOM in-page and serializes everything
 *     we observed (a `RawStyleData` blob) — this needs Chromium.
 *   - `aggregateDesignData(raw)` is a *pure* reducer from that blob to the
 *     `ExtractedDesign` shape the codegen prompt consumes — fully unit-tested.
 *   - `buildDesignSpec(design)` is a *pure* markdown renderer of the result.
 * `extractDesignData(url)` is thin orchestration glue over Browserless.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Raw intermediate (everything `aggregateDesignData` needs, JSON-serializable).
// Each "usage" / "area" number is a painted bounding-box area (w*h) used to
// weight how dominant a given style is — bigger area = ranks higher.
// ─────────────────────────────────────────────────────────────────────────────
export type RawStyleData = {
  /** One entry per (element, role) color observation, weighted by painted area. */
  colorUsages: { color: string; prop: "background" | "text" | "border"; area: number }[];
  /** Font-family observations weighted by painted area, flagged heading/mono. */
  fontUsages: { family: string; area: number; heading: boolean; mono: boolean }[];
  /** Font-size observations (rounded px) weighted by painted area. */
  fontSizesPx: { px: number; area: number }[];
  fontWeights: number[];
  lineHeights: string[];
  letterSpacings: string[];
  /** Padding/margin/gap values in px (raw, unfiltered). */
  spacingsPx: number[];
  /** Border-radius values in px (raw, unfiltered). */
  radiiPx: number[];
  /** Non-"none" box-shadow values (raw, repeats kept for frequency ranking). */
  shadows: string[];
  /** Computed `background-image` gradient values weighted by painted area. */
  gradients?: { value: string; area: number }[];
  /** Painted areas of `<canvas>` elements (likely WebGL/shader backgrounds). */
  canvasAreas?: number[];
  /** Sampled button computed styles. */
  buttons: Record<string, string>[];
  /** Top-level page sections in document order. */
  sections: {
    tag: string;
    label: string;
    heightPx: number;
    background: string;
    textColor: string;
    fontSizesPx: number[];
  }[];
  layout: { maxContentWidthPx: number | null; sectionCount: number; viewportWidthPx: number };
  /** Webfont families the page actually loaded (document.fonts). */
  loadedFonts: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// In-page collection — runs inside the browser, returns a plain object.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk the live DOM and gather computed styles weighted by painted area, so the
 * aggregator can rank styles by how much of the page actually uses them. Only
 * visible elements count; arrays are bounded to keep the payload small.
 */
export async function collectRawStyles(page: import("puppeteer-core").Page): Promise<RawStyleData> {
  // tsx compiles this file with esbuild's `keepNames` on, which rewrites the
  // named helper arrows below (isVisible, isTransparent, …) into `__name(fn,
  // "name")` calls. `__name` is defined in the bundle scope, but page.evaluate
  // serializes only the function body into the browser — where `__name` does
  // not exist — so the in-page code throws "__name is not defined". Install an
  // identity shim on the page first. Passed as a string so esbuild can't
  // instrument *this* line too.
  await page.evaluate("globalThis.__name = globalThis.__name || ((fn) => fn);");

  const raw = await page.evaluate(() => {
    // ---- helpers (in-page; no access to outer scope) -------------------------
    const isVisible = (el: Element, st: CSSStyleDeclaration, rect: DOMRect): boolean => {
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (st.display === "none" || st.visibility === "hidden") return false;
      if (parseFloat(st.opacity || "1") <= 0.05) return false;
      return true;
    };
    const isTransparent = (color: string): boolean => {
      if (!color || color === "transparent") return true;
      const m = color.match(/rgba?\(([^)]+)\)/i);
      if (!m) return false;
      const parts = m[1].split(",").map((p) => p.trim());
      if (parts.length >= 4) return parseFloat(parts[3]) === 0;
      return false;
    };
    const isMono = (family: string): boolean => /mono|courier|consolas/i.test(family);
    const SECTION_TAGS = new Set(["header", "nav", "section", "footer", "main"]);

    // ---- accumulators --------------------------------------------------------
    const colorUsages: { color: string; prop: "background" | "text" | "border"; area: number }[] = [];
    const fontUsages: { family: string; area: number; heading: boolean; mono: boolean }[] = [];
    const fontSizesPx: { px: number; area: number }[] = [];
    const fontWeights: number[] = [];
    const lineHeights: string[] = [];
    const letterSpacings: string[] = [];
    const spacingsPx: number[] = [];
    const radiiPx: number[] = [];
    const shadows: string[] = [];
    const gradients: { value: string; area: number }[] = [];
    const canvasAreas: number[] = [];

    const COLOR_CAP = 4000;
    const GRADIENT_CAP = 400;
    const pushSpace = (v: string) => {
      const n = parseFloat(v);
      if (!Number.isNaN(n) && n > 0) spacingsPx.push(Math.round(n));
    };

    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      const st = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, st, rect)) continue;
      const area = rect.width * rect.height;
      const tag = el.tagName.toLowerCase();
      const heading = /^h[1-6]$/.test(tag);

      // Colors (weighted by area). Skip fully-transparent values; keep real ones.
      if (colorUsages.length < COLOR_CAP) {
        if (!isTransparent(st.backgroundColor))
          colorUsages.push({ color: st.backgroundColor, prop: "background", area });
        if (!isTransparent(st.color)) colorUsages.push({ color: st.color, prop: "text", area });
        if (!isTransparent(st.borderColor) && parseFloat(st.borderTopWidth || "0") > 0)
          colorUsages.push({ color: st.borderColor, prop: "border", area });
      }

      // Typography (weighted by area).
      const family = st.fontFamily || "";
      if (family) fontUsages.push({ family, area, heading, mono: isMono(family) });
      const sizePx = Math.round(parseFloat(st.fontSize || "0"));
      if (sizePx > 0) fontSizesPx.push({ px: sizePx, area });
      const weight = parseInt(st.fontWeight || "", 10);
      if (!Number.isNaN(weight)) fontWeights.push(weight);
      if (st.lineHeight && st.lineHeight !== "normal") lineHeights.push(st.lineHeight);
      if (st.letterSpacing && st.letterSpacing !== "normal") letterSpacings.push(st.letterSpacing);

      // Spacing scale (padding / margin / gap).
      pushSpace(st.paddingTop);
      pushSpace(st.paddingLeft);
      pushSpace(st.marginTop);
      pushSpace(st.marginLeft);
      if (st.rowGap && st.rowGap !== "normal") pushSpace(st.rowGap);
      if (st.columnGap && st.columnGap !== "normal") pushSpace(st.columnGap);

      // Radii.
      const r = Math.round(parseFloat(st.borderTopLeftRadius || "0"));
      if (r > 0) radiiPx.push(r);

      // Shadows.
      if (st.boxShadow && st.boxShadow !== "none") shadows.push(st.boxShadow);

      // Background gradients (computed background-image). Solid background-color
      // is handled above; this captures the *color that lives in gradients*,
      // which computed-style color reads otherwise miss entirely. url() images
      // are skipped — we can't reproduce them and only want gradient color.
      const bgImg = st.backgroundImage;
      if (gradients.length < GRADIENT_CAP && bgImg && bgImg !== "none" && /gradient/i.test(bgImg)) {
        gradients.push({ value: bgImg, area });
      }

      // Canvas elements (likely WebGL/shader backgrounds) — record painted area
      // so the aggregator can flag full-bleed shader backgrounds.
      if (tag === "canvas") canvasAreas.push(area);
    }

    // ---- buttons (sample) ----------------------------------------------------
    const buttons: Record<string, string>[] = [];
    const btnEls = Array.from(
      document.querySelectorAll('button, a[class*="btn"], [role="button"], a[class*="button"]')
    ).slice(0, 8);
    for (const b of btnEls) {
      const st = getComputedStyle(b);
      const rect = b.getBoundingClientRect();
      if (!isVisible(b, st, rect)) continue;
      buttons.push({
        background: st.backgroundColor,
        color: st.color,
        padding: `${st.paddingTop} ${st.paddingRight} ${st.paddingBottom} ${st.paddingLeft}`,
        borderRadius: st.borderTopLeftRadius,
        fontWeight: st.fontWeight,
        border: st.borderTopWidth !== "0px" ? `${st.borderTopWidth} ${st.borderStyle} ${st.borderColor}` : "none",
        fontSize: st.fontSize,
      });
    }

    // ---- sections (direct structural children of body and <main>) ------------
    const sections: RawStyleData["sections"] = [];
    const roots: Element[] = [document.body];
    const mainEl = document.querySelector("main");
    if (mainEl) roots.push(mainEl);
    const seenSection = new Set<Element>();
    for (const root of roots) {
      for (const child of Array.from(root.children)) {
        if (sections.length >= 12) break;
        if (seenSection.has(child)) continue;
        const tag = child.tagName.toLowerCase();
        const st = getComputedStyle(child);
        const rect = child.getBoundingClientRect();
        if (!isVisible(child, st, rect)) continue;
        const structural = SECTION_TAGS.has(tag) || tag === "div";
        if (!structural) continue;
        // Large block OR a semantic section tag.
        if (!(rect.height > 200 || SECTION_TAGS.has(tag))) continue;
        seenSection.add(child);
        const txt = ((child as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
        const label = txt ? txt.slice(0, 60) : tag;
        // Distinct font sizes within this section (rounded).
        const sizes = new Set<number>();
        for (const d of Array.from(child.querySelectorAll("*")).slice(0, 200)) {
          const s = Math.round(parseFloat(getComputedStyle(d).fontSize || "0"));
          if (s > 0) sizes.add(s);
        }
        sections.push({
          tag,
          label,
          heightPx: Math.round(rect.height),
          background: st.backgroundColor,
          textColor: st.color,
          fontSizesPx: Array.from(sizes).sort((a, b) => a - b),
        });
      }
    }

    // ---- layout --------------------------------------------------------------
    const viewportWidthPx = window.innerWidth;
    // Best-effort max content width: most common width of large centered blocks
    // (auto horizontal margins), else the widest block narrower than viewport.
    const widthCounts = new Map<number, number>();
    let widest = 0;
    for (const el of all.slice(0, 3000)) {
      const st = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.width > viewportWidthPx) continue;
      const centered = st.marginLeft === "auto" && st.marginRight === "auto";
      const w = Math.round(rect.width);
      if (w > widest && w < viewportWidthPx) widest = w;
      if (centered && rect.width > viewportWidthPx * 0.4) {
        widthCounts.set(w, (widthCounts.get(w) || 0) + 1);
      }
    }
    let maxContentWidthPx: number | null = null;
    if (widthCounts.size) {
      maxContentWidthPx = Array.from(widthCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    } else if (widest > 0) {
      maxContentWidthPx = widest;
    }

    // ---- loaded fonts --------------------------------------------------------
    const fontSet = (document as unknown as { fonts?: Iterable<{ family?: string }> }).fonts;
    const loadedFonts = Array.from(
      new Set(
        Array.from(fontSet || []).map((f) => (f.family || "").replace(/['"]/g, ""))
      )
    ).filter(Boolean);

    return {
      colorUsages,
      fontUsages,
      fontSizesPx,
      fontWeights,
      lineHeights,
      letterSpacings,
      spacingsPx,
      radiiPx,
      shadows,
      gradients,
      canvasAreas,
      buttons,
      sections,
      layout: { maxContentWidthPx, sectionCount: sections.length, viewportWidthPx },
      loadedFonts,
    };
  });

  return raw as RawStyleData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure aggregation — RawStyleData → ExtractedDesign. This is the tested core.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse `rgb(r,g,b)` / `rgba(r,g,b,a)` into a lowercase `#rrggbb`. If the input
 * isn't an rgb()-form string (already hex, a named color, etc.), return it
 * unchanged so we never corrupt values we can't confidently parse.
 */
function rgbToHex(color: string): string {
  if (!color) return color;
  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (!m) return color;
  const parts = m[1].split(",").map((p) => p.trim());
  if (parts.length < 3) return color;
  const to2 = (v: string) => {
    const n = Math.max(0, Math.min(255, Math.round(parseFloat(v))));
    return n.toString(16).padStart(2, "0");
  };
  return `#${to2(parts[0])}${to2(parts[1])}${to2(parts[2])}`.toLowerCase();
}

/** Parse a hex (#rgb / #rrggbb) into [r,g,b], or null if not a hex string. */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Pull the *opaque* color stops out of a computed gradient string, as hex.
 * Skips fully-transparent stops (rgba(...,0)) since those carry no color and are
 * just the gradient's fade-out. Returns colors in stop order, deduped.
 */
function gradientColors(css: string): string[] {
  const out: string[] = [];
  const re = /rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const token = m[0];
    const rgba = token.match(/rgba?\(([^)]+)\)/i);
    if (rgba) {
      const parts = rgba[1].split(",").map((p) => p.trim());
      if (parts.length >= 4 && parseFloat(parts[3]) === 0) continue; // transparent stop
    }
    out.push(rgbToHex(token));
  }
  return Array.from(new Set(out));
}

/** A color is "grayscale" when its channels are near-equal (low saturation). */
function isGrayscale(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  return Math.max(r, g, b) - Math.min(r, g, b) <= 16;
}

/** Perceived luminance 0..255 (Rec. 601 weights), for surface/mid-tone tests. */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function topByCount<T extends string | number>(values: T[], cap: number): T[] {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map((e) => e[0]);
}

function ascendingDistinct(values: number[], cap: number): number[] {
  return Array.from(new Set(values))
    .sort((a, b) => a - b)
    .slice(0, cap);
}

/**
 * Reduce raw observations into the ground-truth `ExtractedDesign`.
 *
 * Conventions:
 *  - `usage` (palette + families) is the **rounded total painted area** that
 *    color/family covered, so larger numbers mean a more dominant style. It is
 *    not normalized to 0..100 — callers compare relative magnitudes.
 *  - Palette roles: each color is first bucketed by the CSS prop it came from
 *    (background→"background", text→"text", border→"border"). After ranking we
 *    additionally *promote* the most-used vivid (non-grayscale) color to an
 *    "accent" entry, and the most-used mid-tone background (a grayscale-ish,
 *    non-extreme-luminance background) to a "surface" entry — these are added
 *    on top of the base roles, deduped by hex+role, then re-ranked.
 */
export function aggregateDesignData(raw: RawStyleData): ExtractedDesign {
  // ---- palette ---------------------------------------------------------------
  type Role = ExtractedDesign["palette"][number]["role"];
  const propToRole: Record<RawStyleData["colorUsages"][number]["prop"], Role> = {
    background: "background",
    text: "text",
    border: "border",
  };
  // Sum area per (hex, base-role).
  const paletteArea = new Map<string, { hex: string; role: Role; usage: number }>();
  for (const c of raw.colorUsages) {
    const hex = rgbToHex(c.color);
    const role = propToRole[c.prop];
    const key = `${hex}|${role}`;
    const prev = paletteArea.get(key);
    if (prev) prev.usage += c.area;
    else paletteArea.set(key, { hex, role, usage: c.area });
  }

  // Promote an accent (most-used vivid background/text) and a surface (most-used
  // mid-tone background) from the observed colors.
  const colorTotals = new Map<string, number>();
  const bgTotals = new Map<string, number>();
  for (const c of raw.colorUsages) {
    const hex = rgbToHex(c.color);
    colorTotals.set(hex, (colorTotals.get(hex) || 0) + c.area);
    if (c.prop === "background") bgTotals.set(hex, (bgTotals.get(hex) || 0) + c.area);
  }
  const ranked = (m: Map<string, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]);

  let accent: { hex: string; usage: number } | null = null;
  for (const [hex, usage] of ranked(colorTotals)) {
    const rgb = hexToRgb(hex);
    if (rgb && !isGrayscale(rgb)) {
      accent = { hex, usage };
      break;
    }
  }
  let surface: { hex: string; usage: number } | null = null;
  for (const [hex, usage] of ranked(bgTotals)) {
    const rgb = hexToRgb(hex);
    // Mid-tone: grayscale-ish background that isn't near-white or near-black.
    if (rgb && isGrayscale(rgb)) {
      const l = luminance(rgb);
      if (l > 24 && l < 232) {
        surface = { hex, usage };
        break;
      }
    }
  }

  // Gradients (background-image). Sum area per distinct gradient string, rank,
  // and keep the dominant few with their parsed color stops. This is the color
  // that solid-background reads miss, so it's also fed back into the palette.
  const gradAreaByCss = new Map<string, number>();
  for (const g of raw.gradients ?? []) gradAreaByCss.set(g.value, (gradAreaByCss.get(g.value) || 0) + g.area);
  const gradients = Array.from(gradAreaByCss.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([css, area]) => ({ css, colors: gradientColors(css), usage: Math.round(area) }));

  // Large <canvas> elements are almost always WebGL/shader backgrounds. Count
  // only the sizeable ones (> ~300×300) so tiny chart/sparkline canvases don't
  // get mistaken for a full-bleed shader.
  const shaderCanvases = (raw.canvasAreas ?? []).filter((a) => a > 90_000).length;

  const paletteEntries = Array.from(paletteArea.values());
  if (accent) paletteEntries.push({ hex: accent.hex, role: "accent", usage: accent.usage });
  if (surface) paletteEntries.push({ hex: surface.hex, role: "surface", usage: surface.usage });
  // Vivid gradient stops are real page colors — surface them in the palette as
  // accents so codegen doesn't see an all-neutral palette on a colorful page.
  for (const g of gradients) {
    for (const hex of g.colors) {
      const rgb = hexToRgb(hex);
      if (rgb && !isGrayscale(rgb)) paletteEntries.push({ hex, role: "accent", usage: g.usage });
    }
  }

  // Dedupe by hex+role (accent/surface may collide with a base entry) and rank.
  const dedupedPalette = new Map<string, { hex: string; role: Role; usage: number }>();
  for (const e of paletteEntries) {
    const key = `${e.hex}|${e.role}`;
    const prev = dedupedPalette.get(key);
    if (prev) prev.usage = Math.max(prev.usage, e.usage);
    else dedupedPalette.set(key, { ...e });
  }
  const palette = Array.from(dedupedPalette.values())
    .map((e) => ({ ...e, usage: Math.round(e.usage) }))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 10);

  // ---- typography: families --------------------------------------------------
  const primaryFamily = (family: string): string => {
    const first = family.split(",")[0] || family;
    return first.replace(/['"]/g, "").trim();
  };
  type FamAgg = { area: number; headingArea: number; mono: boolean };
  const famMap = new Map<string, FamAgg>();
  for (const f of raw.fontUsages) {
    const name = primaryFamily(f.family);
    if (!name) continue;
    const prev = famMap.get(name) || { area: 0, headingArea: 0, mono: false };
    prev.area += f.area;
    if (f.heading) prev.headingArea += f.area;
    if (f.mono) prev.mono = true;
    famMap.set(name, prev);
  }
  const famRanked = Array.from(famMap.entries()).sort((a, b) => b[1].area - a[1].area);
  type FamRole = ExtractedDesign["typography"]["families"][number]["role"];
  const families = famRanked.slice(0, 8).map(([name, agg], i): { name: string; role: FamRole; usage: number } => {
    let role: FamRole;
    if (agg.mono) role = "mono";
    // A family that carries a meaningful share of heading area is the heading face.
    else if (agg.headingArea > 0 && agg.headingArea >= agg.area * 0.25) role = "heading";
    else if (i === 0) role = "body";
    else role = "other";
    return { name, role, usage: Math.round(agg.area) };
  });

  // ---- typography: sizes (area-weighted, meaningful only) --------------------
  const sizeArea = new Map<number, number>();
  let totalSizeArea = 0;
  for (const s of raw.fontSizesPx) {
    sizeArea.set(s.px, (sizeArea.get(s.px) || 0) + s.area);
    totalSizeArea += s.area;
  }
  // "Meaningful" = at least 0.1% of total typographic area, so stray one-offs drop.
  const sizeThreshold = totalSizeArea * 0.001;
  const sizesPx = Array.from(sizeArea.entries())
    .filter(([, a]) => a >= sizeThreshold)
    .map(([px]) => px)
    .filter((px) => px > 0)
    .sort((a, b) => a - b)
    .slice(0, 10);

  const weights = ascendingDistinct(raw.fontWeights, 8);
  const lineHeights = topByCount(raw.lineHeights, 6);
  const letterSpacings = topByCount(raw.letterSpacings, 6);

  // ---- spacing / radii / shadows ---------------------------------------------
  const spacingScalePx = ascendingDistinct(
    raw.spacingsPx.filter((n) => n > 0 && n <= 256),
    12
  );
  const radiiPx = ascendingDistinct(
    raw.radiiPx.filter((n) => n > 0),
    8
  );
  const shadows = topByCount(
    raw.shadows.filter((s) => s && s !== "none"),
    6
  );

  // ---- buttons (dedupe identical style objects) ------------------------------
  const seenBtn = new Set<string>();
  const buttons: Record<string, string>[] = [];
  for (const b of raw.buttons) {
    const key = JSON.stringify(b);
    if (seenBtn.has(key)) continue;
    seenBtn.add(key);
    buttons.push(b);
    if (buttons.length >= 6) break;
  }

  // ---- sections / layout / fonts (pass through, bounded) ---------------------
  const sections = raw.sections.slice(0, 12).map((s) => ({
    tag: s.tag,
    label: s.label.slice(0, 60),
    heightPx: Math.round(s.heightPx),
    background: s.background,
    textColor: s.textColor,
    fontSizesPx: Array.from(new Set(s.fontSizesPx)).sort((a, b) => a - b),
  }));
  const loadedFonts = Array.from(new Set(raw.loadedFonts.filter(Boolean))).slice(0, 20);

  return {
    palette,
    typography: { families, sizesPx, weights, lineHeights, letterSpacings },
    spacingScalePx,
    radiiPx,
    shadows,
    gradients,
    shaderCanvases,
    buttons,
    layout: raw.layout,
    sections,
    loadedFonts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure spec renderer — ExtractedDesign → compact markdown for the codegen prompt.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render `ExtractedDesign` as a dense, ground-truth markdown brief to inject
 * into the codegen prompt. Everything here is a *real* measured value — the
 * model is meant to use these literally rather than guess from a screenshot.
 */
export function buildDesignSpec(design: ExtractedDesign): string {
  const lines: string[] = [];
  const L = (s: string) => lines.push(s);

  L("# Extracted design system (ground truth from live computed styles)");
  L("Use these exact values. They were measured from the real page, not inferred.");
  L("");

  // Palette.
  L("## Exact palette (hex — use these literally)");
  if (design.palette.length) {
    for (const p of design.palette) {
      L(`- ${p.hex} — ${p.role}`);
    }
  } else {
    L("- (none captured)");
  }
  L("");

  // Backgrounds — gradients and shader canvases. Critical signal: a page whose
  // color lives in a gradient/shader has an otherwise-neutral palette, so call
  // these out explicitly and tell the model to reproduce them.
  if (design.gradients.length || design.shaderCanvases) {
    L("## Backgrounds (reproduce these — the page is NOT flat/neutral)");
    if (design.shaderCanvases) {
      L(
        `- ${design.shaderCanvases} full-bleed <canvas> background(s) detected (likely an animated ` +
          `WebGL/shader). Approximate it with layered CSS gradients using the colors below.`
      );
    }
    for (const g of design.gradients) {
      const colors = g.colors.length ? ` [colors: ${g.colors.join(", ")}]` : "";
      L(`- ${g.css.slice(0, 220)}${colors}`);
    }
    L("");
  }

  // Typography.
  L("## Typography (real families + type scale in px)");
  if (design.typography.families.length) {
    L(
      "Families: " +
        design.typography.families.map((f) => `${f.name} (${f.role})`).join(", ")
    );
  }
  if (design.loadedFonts.length) L("Loaded webfonts: " + design.loadedFonts.join(", "));
  if (design.typography.sizesPx.length)
    L("Type scale (px): " + design.typography.sizesPx.join(", "));
  if (design.typography.weights.length)
    L("Weights: " + design.typography.weights.join(", "));
  if (design.typography.lineHeights.length)
    L("Line heights: " + design.typography.lineHeights.join(", "));
  if (design.typography.letterSpacings.length)
    L("Letter spacing: " + design.typography.letterSpacings.join(", "));
  L("");

  // Spacing.
  if (design.spacingScalePx.length) {
    L("## Spacing scale (px)");
    L(design.spacingScalePx.join(", "));
    L("");
  }

  // Radii.
  if (design.radiiPx.length) {
    L("## Radii (px)");
    L(design.radiiPx.join(", "));
    L("");
  }

  // Shadows.
  if (design.shadows.length) {
    L("## Shadows (most common first)");
    for (const s of design.shadows) L(`- ${s}`);
    L("");
  }

  // Buttons.
  if (design.buttons.length) {
    L("## Buttons (computed styles — match these)");
    design.buttons.forEach((b, i) => {
      const desc = Object.entries(b)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      L(`${i + 1}. ${desc}`);
    });
    L("");
  }

  // Sections.
  if (design.sections.length) {
    L("## Page sections in order");
    design.sections.forEach((s, i) => {
      const sizes = s.fontSizesPx.length ? ` font-sizes: ${s.fontSizesPx.join("/")}` : "";
      L(
        `${i + 1}. <${s.tag}> ${s.heightPx}px tall — bg ${s.background}, text ${s.textColor} — "${s.label}"${sizes}`
      );
    });
    L("");
  }

  // Layout.
  L("## Layout");
  L(
    `Viewport: ${design.layout.viewportWidthPx}px; max content width: ${
      design.layout.maxContentWidthPx ?? "n/a"
    }px; sections: ${design.layout.sectionCount}`
  );

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration — connect, load, scroll, collect, aggregate. Not unit-tested.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load `url` in hosted Browserless Chromium and extract its real design system
 * from computed styles. Thin glue around the (tested) pure aggregator.
 */
export async function extractDesignData(url: string): Promise<ExtractedDesign> {
  const browser = await puppeteer.connect({ browserWSEndpoint: browserlessEndpoint() });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: env.CRAWL_NAV_TIMEOUT_MS });
    // Scroll so lazy sections/backgrounds render before we read computed styles.
    await autoScroll(page);
    const raw = await collectRawStyles(page);
    return aggregateDesignData(raw);
  } finally {
    await browser.close();
  }
}
