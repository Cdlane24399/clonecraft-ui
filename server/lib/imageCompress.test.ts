// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { compressForVision } from "./imageCompress";

function solidPng(width: number, height: number): string {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 10;       // r
    png.data[i + 1] = 120;  // g
    png.data[i + 2] = 200;  // b
    png.data[i + 3] = 255;  // a
  }
  return PNG.sync.write(png).toString("base64");
}

describe("compressForVision", () => {
  it("downscales a tall image so the long edge is within the cap", () => {
    const out = compressForVision(solidPng(1440, 6000), 1536);
    const decoded = PNG.sync.read(Buffer.from(out, "base64"));
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(1536);
    expect(decoded.width).toBeGreaterThan(0);
    // Aspect ratio preserved (within rounding).
    expect(decoded.width / decoded.height).toBeCloseTo(1440 / 6000, 1);
  });

  it("downscales a wide image by its width", () => {
    const out = compressForVision(solidPng(3000, 800), 1536);
    const decoded = PNG.sync.read(Buffer.from(out, "base64"));
    expect(decoded.width).toBeLessThanOrEqual(1536);
  });

  it("returns the input unchanged when already within the cap", () => {
    const small = solidPng(800, 600);
    expect(compressForVision(small, 1536)).toBe(small);
  });

  it("returns the input unchanged on undecodable data instead of throwing", () => {
    expect(compressForVision("not-a-png", 1536)).toBe("not-a-png");
  });
});
