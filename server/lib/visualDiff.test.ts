// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { computePixelDiff, fidelityScore } from "./visualDiff";

/** Build a solid-color RGBA PNG and return it as base64 (no `data:` prefix). */
function solidPng(width: number, height: number, color: [number, number, number, number]): string {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = color[0];
    png.data[i + 1] = color[1];
    png.data[i + 2] = color[2];
    png.data[i + 3] = color[3];
  }
  return PNG.sync.write(png).toString("base64");
}

/** Build a PNG that is white on the top half and black on the bottom half. */
function topWhiteBottomBlackPng(width: number, height: number): string {
  const png = new PNG({ width, height });
  const half = Math.floor(height / 2);
  for (let y = 0; y < height; y++) {
    const v = y < half ? 255 : 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png).toString("base64");
}

/**
 * Build a horizontally-striped PNG (period 16px: 8 white / 8 black). `phase`
 * shifts the pattern vertically, so two stripers with the same `phase` are
 * identical and a phase difference is a pure vertical shift of the same content.
 */
function stripedPng(width: number, height: number, phase: number): string {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const black = Math.floor((y + phase) / 8) % 2 !== 0;
    const v = black ? 0 : 255;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png).toString("base64");
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];

describe("computePixelDiff", () => {
  it("reports ~0 mismatch and full fidelity for identical images", () => {
    const img = solidPng(50, 50, WHITE);
    const result = computePixelDiff(img, img);
    expect(result.mismatch).toBeLessThan(0.001);
    expect(fidelityScore(result.mismatch)).toBe(100);
  });

  it("reports near-total mismatch for fully different images", () => {
    const black = solidPng(50, 50, BLACK);
    const white = solidPng(50, 50, WHITE);
    const result = computePixelDiff(black, white);
    expect(result.mismatch).toBeGreaterThan(0.9);
    expect(fidelityScore(result.mismatch)).toBeLessThan(10);
  });

  it("reports roughly half mismatch when half the pixels differ", () => {
    const halfAndHalf = topWhiteBottomBlackPng(50, 50);
    const white = solidPng(50, 50, WHITE);
    const result = computePixelDiff(halfAndHalf, white);
    expect(result.mismatch).toBeGreaterThan(0.3);
    expect(result.mismatch).toBeLessThan(0.7);
  });

  it("handles mismatched dimensions without throwing (overlap crop)", () => {
    const original = solidPng(100, 400, WHITE);
    const rendered = solidPng(100, 200, WHITE);
    const result = computePixelDiff(original, rendered);
    expect(result.height).toBe(200);
    expect(result.width).toBe(100);
    expect(result.diffPngBase64.length).toBeGreaterThan(0);

    const decoded = PNG.sync.read(Buffer.from(result.diffPngBase64, "base64"));
    expect(decoded.width).toBe(100);
    expect(decoded.height).toBe(200);
  });

  it("penalizes an incomplete clone via the union-height completeness term", () => {
    // A clone half the height of the original — even with a perfect top half —
    // must NOT score ~100; the missing tail counts against it.
    const original = solidPng(100, 400, WHITE);
    const stub = solidPng(100, 200, WHITE);
    const result = computePixelDiff(original, stub);
    expect(result.coverage).toBeCloseTo(0.5, 2);
    expect(result.mismatch).toBeCloseTo(0.5, 1);
    expect(fidelityScore(result.mismatch)).toBeGreaterThan(40);
    expect(fidelityScore(result.mismatch)).toBeLessThan(60);
  });

  it("reports full coverage when heights match", () => {
    const img = solidPng(80, 300, WHITE);
    expect(computePixelDiff(img, img).coverage).toBeCloseTo(1, 5);
  });

  it("tolerates a small global vertical shift (banded alignment)", () => {
    // Same striped content, shifted 24px. A naive top-left diff sees the
    // half-period (8px) phase inversion as ~total mismatch; banded alignment
    // slides each band back into registration and recovers a high score.
    const original = stripedPng(64, 512, 0);
    const shifted = stripedPng(64, 512, -24);
    const result = computePixelDiff(original, shifted);
    expect(result.mismatch).toBeLessThan(0.05);
    expect(fidelityScore(result.mismatch)).toBeGreaterThan(90);
  });

  it("still flags genuinely different content the shift search can't rescue", () => {
    // A shift the search window can't explain stays a real mismatch.
    const original = stripedPng(64, 512, 0);
    const inverted = solidPng(64, 512, BLACK);
    const result = computePixelDiff(original, inverted);
    expect(result.mismatch).toBeGreaterThan(0.3);
  });
});

describe("fidelityScore", () => {
  it("clamps and rounds to [0, 100]", () => {
    expect(fidelityScore(0)).toBe(100);
    expect(fidelityScore(1)).toBe(0);
    expect(fidelityScore(0.5)).toBe(50);
    expect(fidelityScore(-0.5)).toBe(100);
    expect(fidelityScore(1.5)).toBe(0);
  });
});
