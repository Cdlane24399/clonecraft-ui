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

  it("handles mismatched dimensions without throwing (top-left common crop)", () => {
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
