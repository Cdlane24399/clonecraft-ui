import type { RunConfig } from "../db/schema";

export const STACK_LABEL: Record<RunConfig["stack"], string> = {
  react: "React + Tailwind CSS",
  next: "Next.js (App Router) + Tailwind CSS",
  html: "static HTML + CSS",
};

export const GOAL_LABEL: Record<RunConfig["goal"], string> = {
  recreate: "Recreate the page as a high-fidelity match.",
  redesign: "Recreate the structure but modernize the visual layer.",
  rebrand: "Recreate the layout but swap palette, typography, and logo for a fresh brand.",
  saas: "Recreate the marketing page and add an authenticated dashboard shell.",
};

// How much of the captured page text to feed codegen as ground-truth copy.
// Generous (the model needs the real words) but bounded so we never blow the
// input budget on a pathologically long page.
const MAX_PAGE_TEXT_CHARS = 8000;

export const CODEGEN_SYSTEM = (stack: RunConfig["stack"]) =>
  `You are an expert frontend engineer CONVERTING a real, measured web page into ` +
  `clean, production-quality ${STACK_LABEL[stack]} code. You are a CONVERTER, not a ` +
  `content creator. Reproduce what is actually on the page; do not invent, summarize, ` +
  `or "improve" it.\n` +
  `COPY RULES (non-negotiable):\n` +
  `✅ Reproduce all visible text WORD-FOR-WORD from the provided page text.\n` +
  `✅ Keep every URL/href exactly as given.\n` +
  "✅ Convert `class` to `className`.\n" +
  `❌ No Lorem ipsum. ❌ No example.com or other placeholder URLs. ` +
  `❌ Do not summarize, shorten, paraphrase, or invent copy.\n\n` +
  `Output ONLY fenced code blocks, each tagged with its path ` +
  "like ```tsx file=src/App.tsx. The top-level component MUST be `export default` in src/App.tsx. " +
  "Make components self-contained and import siblings with relative paths. " +
  "Use Tailwind utility classes for all styling (a Tailwind runtime is present). " +
  "When a measured design system is provided (exact hex colors, a type scale in px, " +
  "spacing values, button styles, and the page's section order), treat those values as " +
  "ground truth read from the real page — match them precisely (use arbitrary Tailwind " +
  "values like text-[17px], bg-[#0b1120], gap-[28px] when needed) rather than approximating. " +
  "Reproduce the sections in the given order with the given backgrounds and proportions. " +
  "Reproduce full-bleed gradient or shader/canvas backgrounds as layered CSS gradients " +
  "(linear/radial) using the measured gradient colors. If the design spec says the " +
  "background animates, add a subtle CSS keyframe animation (e.g. slowly drifting " +
  "background-position, or large blurred radial-gradient blobs that move/pulse on a long " +
  "ease-in-out loop) — keep it tasteful and performant, no external libraries. CRITICAL: render a decorative " +
  "background layer with `z-0` (or `z-[0]`) inside a `relative` section and put the content " +
  "in a sibling with `relative z-10` — NEVER place a background on a negatively z-indexed " +
  "layer (`-z-10`): it paints behind the page's opaque root background and disappears. " +
  "For real photographic/hero imagery, use a normal img tag whose src goes through the " +
  "preview image proxy: <img src=\"/proxy-image?url=ENCODED_ABSOLUTE_URL\" /> where " +
  "ENCODED_ABSOLUTE_URL is the original image's absolute URL, URL-encoded. Use the " +
  "real image URLs visible in the page. For brand marks/logos and simple icons, prefer " +
  "inline SVG or CSS gradients/solid colors. Do not import images as ES modules. " +
  "lucide-react is available for icons, but only generic icons — its brand icons " +
  "(Github, Twitter, Linkedin, Facebook, etc.) were removed, so render brand marks " +
  "as inline SVG instead. Do not include explanatory prose outside the code blocks.";

export function buildCodegenPrompt(args: {
  stack: RunConfig["stack"];
  goal: RunConfig["goal"];
  passList: string[];
  designSpec: string;
  tokens: { colors: { name: string; value: string }[]; fonts: string[] };
  brief: string;
  components: { name: string }[];
  pageText: string;
}): string {
  const { stack, goal, passList, designSpec, tokens, brief, components, pageText } = args;
  const copyBlock = pageText.trim()
    ? `\n\nSOURCE-OF-TRUTH PAGE COPY (reproduce this text verbatim where it appears; ` +
      `do not paraphrase):\n"""\n${pageText.slice(0, MAX_PAGE_TEXT_CHARS)}\n"""\n`
    : "";

  return (
    `Recreate this page as ${STACK_LABEL[stack]}. Goal: ${GOAL_LABEL[goal]} ` +
    `Apply these passes where relevant: ${passList.join(", ") || "none"}. ` +
    (designSpec
      ? `\n\n${designSpec}\n\n`
      : `Use this extracted design system — colors: ${tokens.colors
          .map((c) => `${c.name} ${c.value}`)
          .join(", ")}; fonts: ${tokens.fonts.join(", ")}. `) +
    (brief ? `Brand details: ${brief}. ` : "") +
    `Detected components: ${components.map((c) => c.name).join(", ")}. ` +
    `Produce a top-level src/App.tsx (export default) plus a component file per major section` +
    (designSpec ? `, matching the measured palette, type scale, spacing and section order above as closely as possible. ` : ". ") +
    `Keep it to real, compiling TSX.` +
    copyBlock
  );
}
