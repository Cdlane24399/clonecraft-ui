// @vitest-environment node
import { describe, it, expect } from "vitest";
import { aggregateDesignData, buildDesignSpec, type RawStyleData } from "./extract";

// A realistic-ish blob: a near-white page with dark text, a vivid blue accent,
// a mid-tone gray surface, a heading face + a body face, plus spacing/radii/
// shadows/buttons/sections so every reducer path is exercised.
function makeRaw(): RawStyleData {
  return {
    colorUsages: [
      // Dominant page background (near-white) — largest area.
      { color: "rgb(255, 255, 255)", prop: "background", area: 1_000_000 },
      // Body text (near-black).
      { color: "rgb(17, 17, 17)", prop: "text", area: 400_000 },
      // Mid-tone gray surface (card backgrounds) — should become "surface".
      { color: "rgb(128, 128, 128)", prop: "background", area: 120_000 },
      // Vivid blue used on buttons/links — should become "accent".
      { color: "rgb(37, 99, 235)", prop: "background", area: 60_000 },
      { color: "rgb(37, 99, 235)", prop: "text", area: 20_000 },
      // A border color.
      { color: "rgb(229, 231, 235)", prop: "border", area: 10_000 },
      // Fully transparent — must be ignored by the collector, but assert hygiene
      // here too in case it slips through.
      { color: "rgba(0, 0, 0, 0)", prop: "background", area: 999_999 },
    ],
    fontUsages: [
      { family: '"Inter", system-ui, sans-serif', area: 500_000, heading: false, mono: false },
      { family: '"Poppins", sans-serif', area: 80_000, heading: true, mono: false },
      { family: '"Fira Code", monospace', area: 5_000, heading: false, mono: true },
    ],
    fontSizesPx: [
      { px: 16, area: 500_000 }, // body — meaningful
      { px: 14, area: 120_000 },
      { px: 48, area: 90_000 }, // hero heading
      { px: 24, area: 40_000 },
      { px: 99, area: 5 }, // negligible area — should be filtered out
    ],
    fontWeights: [400, 400, 600, 700, 400, 600],
    lineHeights: ["24px", "24px", "1.5", "32px"],
    letterSpacings: ["normal-ish", "-0.02em", "-0.02em", "0.05em"],
    spacingsPx: [0, 4, 8, 8, 16, 16, 24, 32, 64, 9999, 300],
    radiiPx: [0, 4, 8, 8, 12, 9999],
    shadows: [
      "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
      "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px",
      "rgba(0, 0, 0, 0.2) 0px 10px 20px 0px",
      "none",
    ],
    buttons: [
      {
        background: "rgb(37, 99, 235)",
        color: "rgb(255, 255, 255)",
        padding: "12px 24px 12px 24px",
        borderRadius: "8px",
        fontWeight: "600",
        border: "none",
        fontSize: "16px",
      },
      // Exact duplicate — must be deduped away.
      {
        background: "rgb(37, 99, 235)",
        color: "rgb(255, 255, 255)",
        padding: "12px 24px 12px 24px",
        borderRadius: "8px",
        fontWeight: "600",
        border: "none",
        fontSize: "16px",
      },
      {
        background: "rgba(0, 0, 0, 0)",
        color: "rgb(37, 99, 235)",
        padding: "12px 24px 12px 24px",
        borderRadius: "8px",
        fontWeight: "500",
        border: "1px solid rgb(37, 99, 235)",
        fontSize: "16px",
      },
    ],
    sections: [
      {
        tag: "header",
        label: "Get started today",
        heightPx: 80,
        background: "rgb(255, 255, 255)",
        textColor: "rgb(17, 17, 17)",
        fontSizesPx: [16, 16, 14],
      },
      {
        tag: "section",
        label: "Build faster with our platform",
        heightPx: 640,
        background: "rgb(255, 255, 255)",
        textColor: "rgb(17, 17, 17)",
        fontSizesPx: [48, 24, 16],
      },
    ],
    layout: { maxContentWidthPx: 1200, sectionCount: 2, viewportWidthPx: 1440 },
    loadedFonts: ["Inter", "Poppins", "Fira Code", "Inter"],
  };
}

describe("aggregateDesignData", () => {
  const design = aggregateDesignData(makeRaw());

  it("ranks palette by area, converts rgb→hex, and assigns roles", () => {
    // Top entry should be the dominant white background, as hex.
    expect(design.palette[0].hex).toBe("#ffffff");
    expect(design.palette[0].role).toBe("background");
    // rgb→hex conversion is correct for a non-trivial value.
    const text = design.palette.find((p) => p.role === "text");
    expect(text?.hex).toBe("#111111");
    // usage is the rounded painted area (not normalized), so it's large.
    expect(design.palette[0].usage).toBe(1_000_000);
    // Higher-area entries rank ahead of lower-area ones.
    for (let i = 1; i < design.palette.length; i++) {
      expect(design.palette[i - 1].usage).toBeGreaterThanOrEqual(design.palette[i].usage);
    }
  });

  it("promotes a vivid accent and a mid-tone surface", () => {
    const accent = design.palette.find((p) => p.role === "accent");
    const surface = design.palette.find((p) => p.role === "surface");
    expect(accent?.hex).toBe("#2563eb"); // the vivid blue
    expect(surface?.hex).toBe("#808080"); // the mid gray
  });

  it("builds an ascending, de-duplicated type scale and filters tiny-area sizes", () => {
    expect(design.typography.sizesPx).toEqual([14, 16, 24, 48]);
    // negligible 99px (area 5) is dropped.
    expect(design.typography.sizesPx).not.toContain(99);
  });

  it("classifies font families by role and strips fallbacks", () => {
    const inter = design.typography.families.find((f) => f.name === "Inter");
    const poppins = design.typography.families.find((f) => f.name === "Poppins");
    const fira = design.typography.families.find((f) => f.name === "Fira Code");
    expect(inter?.role).toBe("body");
    expect(poppins?.role).toBe("heading");
    expect(fira?.role).toBe("mono");
  });

  it("produces an ascending spacing scale, filtering 0 and absurd values", () => {
    expect(design.spacingScalePx).toEqual([4, 8, 16, 24, 32, 64]);
    expect(design.spacingScalePx).not.toContain(0);
    expect(design.spacingScalePx).not.toContain(9999);
    expect(design.spacingScalePx).not.toContain(300);
    // ascending
    expect([...design.spacingScalePx].sort((a, b) => a - b)).toEqual(design.spacingScalePx);
  });

  it("produces ascending radii filtering 0", () => {
    expect(design.radiiPx).toEqual([4, 8, 12, 9999].filter((v) => v > 0));
    expect(design.radiiPx).not.toContain(0);
  });

  it("dedupes shadows (and drops none), most common first", () => {
    expect(design.shadows[0]).toBe("rgba(0, 0, 0, 0.1) 0px 1px 3px 0px");
    expect(design.shadows).not.toContain("none");
    expect(new Set(design.shadows).size).toBe(design.shadows.length);
  });

  it("dedupes identical button style objects", () => {
    // Two identical primary buttons collapse to one; the outline variant stays.
    expect(design.buttons.length).toBe(2);
  });

  it("passes through sections, layout, and loadedFonts (deduped)", () => {
    expect(design.sections.length).toBe(2);
    expect(design.sections[0].tag).toBe("header");
    expect(design.sections[0].fontSizesPx).toEqual([14, 16]);
    expect(design.layout).toEqual({ maxContentWidthPx: 1200, sectionCount: 2, viewportWidthPx: 1440 });
    expect(design.loadedFonts).toEqual(["Inter", "Poppins", "Fira Code"]);
  });
});

describe("buildDesignSpec", () => {
  const design = aggregateDesignData(makeRaw());
  const spec = buildDesignSpec(design);

  it("returns a non-empty markdown string carrying real ground-truth values", () => {
    expect(spec.length).toBeGreaterThan(100);
    // A real hex from the palette.
    expect(spec).toContain("#2563eb");
    // A real px size from the type scale.
    expect(spec).toContain("48");
    // A real font family.
    expect(spec).toContain("Inter");
    // Layout numbers.
    expect(spec).toContain("1440");
    expect(spec).toContain("1200");
    // Headers present.
    expect(spec).toContain("Exact palette");
    expect(spec).toContain("Typography");
  });
});

describe("gradient + shader extraction", () => {
  const raw: RawStyleData = {
    colorUsages: [
      // An all-neutral solid palette — the colorful signal lives only in the gradient.
      { color: "rgb(250, 250, 250)", prop: "background", area: 1_000_000 },
      { color: "rgb(3, 3, 3)", prop: "text", area: 300_000 },
    ],
    fontUsages: [],
    fontSizesPx: [],
    fontWeights: [],
    lineHeights: [],
    letterSpacings: [],
    spacingsPx: [],
    radiiPx: [],
    shadows: [],
    gradients: [
      // The dominant hero gradient (largest area), with a transparent fade-out stop.
      {
        value:
          "linear-gradient(rgb(90, 120, 255) 0%, rgb(196, 60, 255) 40%, rgba(255, 255, 255, 0) 60%), radial-gradient(rgb(255, 90, 31) 0%, rgb(255, 45, 110) 25%)",
        area: 800_000,
      },
      { value: "linear-gradient(rgb(90, 120, 255) 0%, rgb(196, 60, 255) 40%, rgba(255, 255, 255, 0) 60%), radial-gradient(rgb(255, 90, 31) 0%, rgb(255, 45, 110) 25%)", area: 200_000 },
      // A small, dull gradient that should rank lower.
      { value: "linear-gradient(rgb(240, 240, 240) 0%, rgb(220, 220, 220) 100%)", area: 5_000 },
    ],
    canvasAreas: [1_200_000, 50_000], // one full-bleed shader canvas + one tiny chart
    buttons: [],
    sections: [],
    layout: { maxContentWidthPx: 1280, sectionCount: 0, viewportWidthPx: 1440 },
    loadedFonts: [],
  };
  const design = aggregateDesignData(raw);

  it("ranks gradients by painted area and parses opaque color stops", () => {
    expect(design.gradients[0].usage).toBe(1_000_000); // two identical entries summed
    // Transparent stop is dropped; vivid stops are parsed to hex.
    expect(design.gradients[0].colors).toEqual(["#5a78ff", "#c43cff", "#ff5a1f", "#ff2d6e"]);
    expect(design.gradients[0].colors).not.toContain("#ffffff");
  });

  it("flags only full-bleed canvases as shaders", () => {
    expect(design.shaderCanvases).toBe(1); // the 1.2M-area canvas, not the 50k one
  });

  it("promotes vivid gradient colors into the otherwise-neutral palette as accents", () => {
    const accents = design.palette.filter((p) => p.role === "accent").map((p) => p.hex);
    expect(accents).toContain("#5a78ff");
    expect(accents).toContain("#ff2d6e");
  });

  it("surfaces gradients + shader in the design spec", () => {
    const spec = buildDesignSpec(design);
    expect(spec).toContain("Backgrounds");
    expect(spec).toContain("shader");
    expect(spec).toContain("#ff5a1f");
  });
});

describe("modern gradient color syntaxes + animated backgrounds", () => {
  // Minimal raw factory with only the fields these tests need.
  const baseRaw = (over: Partial<RawStyleData>): RawStyleData => ({
    colorUsages: [{ color: "rgb(250, 250, 250)", prop: "background", area: 1_000_000 }],
    fontUsages: [],
    fontSizesPx: [],
    fontWeights: [],
    lineHeights: [],
    letterSpacings: [],
    spacingsPx: [],
    radiiPx: [],
    shadows: [],
    buttons: [],
    sections: [],
    layout: { maxContentWidthPx: null, sectionCount: 0, viewportWidthPx: 1440 },
    loadedFonts: [],
    ...over,
  });

  it("parses hsl() and color(srgb …) stops to hex", () => {
    const d = aggregateDesignData(
      baseRaw({
        gradients: [
          { value: "linear-gradient(hsl(0 100% 50%) 0%, hsl(120, 100%, 50%) 100%)", area: 500_000 },
          { value: "linear-gradient(color(srgb 0 0 1) 0%, color(srgb 1 1 1) 100%)", area: 400_000 },
        ],
      })
    );
    expect(d.gradients[0].colors).toEqual(["#ff0000", "#00ff00"]);
    expect(d.gradients[1].colors).toEqual(["#0000ff", "#ffffff"]);
  });

  it("parses oklch()/oklab() stops (black/white exact, vivid stays a valid hex) and skips transparent", () => {
    const d = aggregateDesignData(
      baseRaw({
        gradients: [
          {
            value:
              "linear-gradient(oklch(0 0 0) 0%, oklch(1 0 0) 50%, oklch(0.628 0.2577 29.23) 75%, oklch(0.7 0.1 200 / 0) 100%)",
            area: 500_000,
          },
        ],
      })
    );
    const colors = d.gradients[0].colors;
    expect(colors).toContain("#000000"); // oklch black
    expect(colors).toContain("#ffffff"); // oklch white
    // The vivid red-ish stop converts to a valid opaque hex that's clearly red.
    const vivid = colors.find((c) => c !== "#000000" && c !== "#ffffff");
    expect(vivid).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(vivid!.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    // The fully-transparent oklch(... / 0) stop is dropped.
    expect(colors.length).toBe(3);
  });

  it("flags an animated background from a full-bleed animated gradient element", () => {
    const d = aggregateDesignData(baseRaw({ animatedBgAreas: [1_200_000] }));
    expect(d.animatedBackground).toBe(true);
  });

  it("treats a shader canvas as animated, and ignores tiny animated elements", () => {
    expect(aggregateDesignData(baseRaw({ canvasAreas: [1_200_000] })).animatedBackground).toBe(true);
    expect(aggregateDesignData(baseRaw({ animatedBgAreas: [40_000] })).animatedBackground).toBe(false);
    expect(aggregateDesignData(baseRaw({})).animatedBackground).toBe(false);
  });

  it("calls out the animation in the design spec", () => {
    const d = aggregateDesignData(baseRaw({ animatedBgAreas: [1_200_000] }));
    expect(buildDesignSpec(d)).toContain("ANIMATES");
  });

  it("flags animated gradient text from small animated bg-clip:text spans", () => {
    // Headline spans are small, so this uses a low area threshold.
    const d = aggregateDesignData(baseRaw({ animatedTextAreas: [31_000, 17_000] }));
    expect(d.animatedGradientText).toBe(true);
    expect(buildDesignSpec(d)).toContain("ANIMATED GRADIENT TEXT");
    // A sub-1k speck does not trip it.
    expect(aggregateDesignData(baseRaw({ animatedTextAreas: [500] })).animatedGradientText).toBe(false);
  });
});

describe("rgb→hex (via aggregateDesignData)", () => {
  it("leaves already-hex / named colors unchanged and clamps channels", () => {
    const raw: RawStyleData = {
      colorUsages: [
        { color: "#abcdef", prop: "background", area: 10 }, // already hex
        { color: "rebeccapurple", prop: "text", area: 5 }, // named — unchanged
        { color: "rgb(300, -5, 128)", prop: "border", area: 1 }, // clamps to ff00 80
      ],
      fontUsages: [],
      fontSizesPx: [],
      fontWeights: [],
      lineHeights: [],
      letterSpacings: [],
      spacingsPx: [],
      radiiPx: [],
      shadows: [],
      buttons: [],
      sections: [],
      layout: { maxContentWidthPx: null, sectionCount: 0, viewportWidthPx: 1440 },
      loadedFonts: [],
    };
    const out = aggregateDesignData(raw);
    const hexes = out.palette.map((p) => p.hex);
    expect(hexes).toContain("#abcdef");
    expect(hexes).toContain("rebeccapurple");
    expect(hexes).toContain("#ff0080");
  });
});
