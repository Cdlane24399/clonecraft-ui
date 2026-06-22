import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/**
 * Result of comparing the original screenshot against the rendered clone.
 * `mismatch` is the fraction of differing pixels (0..1); `diffPngBase64` is a
 * red-highlighted visualization of those differences (no `data:` prefix).
 */
export type PixelDiffResult = {
  mismatch: number;
  diffPngBase64: string;
  width: number;
  height: number;
};

/**
 * Crop an RGBA image to a smaller canvas from the top-left corner. Returns a
 * fresh buffer of exactly dstW*dstH*4 bytes so pixelmatch sees correctly sized
 * inputs (it rejects mismatched lengths).
 */
function cropRGBA(src: Buffer, srcW: number, srcH: number, dstW: number, dstH: number): Buffer {
  const out = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const srcRow = (y * srcW) * 4;
    const dstRow = (y * dstW) * 4;
    // Copy one full row of the cropped width at a time.
    src.copy(out, dstRow, srcRow, srcRow + dstW * 4);
  }
  return out;
}

/**
 * Compare two base64-encoded PNG screenshots (no `data:` prefix) pixel by pixel.
 *
 * Full-page shots of the original and the clone almost never share dimensions —
 * the original is typically a tall scroll capture while the clone differs in
 * height (and sometimes width). pixelmatch demands identical dimensions, so we
 * normalize to the overlapping region: the min of each axis, cropped from the
 * top-left. Top-left is the right anchor because web pages are top-aligned —
 * the header/hero line up at (0,0), and cropping the bottom only drops the
 * tail of the longer page rather than shifting everything out of registration.
 */
export function computePixelDiff(
  originalBase64: string,
  renderedBase64: string,
  options?: { threshold?: number }
): PixelDiffResult {
  const a = PNG.sync.read(Buffer.from(originalBase64, "base64"));
  const b = PNG.sync.read(Buffer.from(renderedBase64, "base64"));

  const commonW = Math.min(a.width, b.width);
  const commonH = Math.min(a.height, b.height);

  // Guard against zero-area inputs: nothing to compare, so report a perfect
  // (0) mismatch with an empty 0x0 diff rather than dividing by zero.
  if (commonW <= 0 || commonH <= 0) {
    return { mismatch: 0, diffPngBase64: "", width: 0, height: 0 };
  }

  const aCrop = cropRGBA(a.data, a.width, a.height, commonW, commonH);
  const bCrop = cropRGBA(b.data, b.width, b.height, commonW, commonH);

  const diff = new PNG({ width: commonW, height: commonH });
  const mismatchedPixels = pixelmatch(aCrop, bCrop, diff.data, commonW, commonH, {
    threshold: options?.threshold ?? 0.1,
  });

  const mismatch = mismatchedPixels / (commonW * commonH);
  const diffPngBase64 = PNG.sync.write(diff).toString("base64");

  return { mismatch, diffPngBase64, width: commonW, height: commonH };
}

/**
 * Map a pixel mismatch fraction (0..1) onto a 0..100 fidelity score, where 100
 * means the clone is pixel-identical and 0 means entirely different.
 */
export function fidelityScore(mismatch: number): number {
  const score = Math.round((1 - mismatch) * 100);
  return Math.max(0, Math.min(100, score));
}
