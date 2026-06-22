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
  /** Width of the compared overlap (= the diff image width). */
  width: number;
  /** Height of the compared overlap (= the diff image height). */
  height: number;
  /** Fraction of the taller page's height the clone actually covers (0..1). */
  coverage: number;
};

// Banded vertical-alignment parameters. We score the overlap in horizontal
// bands and let each band slide a little vertically to find its best match in
// the original. This makes the metric tolerant of a global vertical shift (a
// hero that's 80px too short no longer throws every section below it out of
// registration) while still penalizing genuinely wrong content — the search
// window is small, so a band can't find a spurious match far away.
const BAND_HEIGHT = 256;
const MAX_OFFSET = 60;
const OFFSET_STEP = 12;

/**
 * Copy rows [y0, y0+h) × cols [0, w) of an RGBA image into a fresh buffer of
 * exactly w*h*4 bytes, so pixelmatch sees correctly sized inputs.
 */
function cropRGBA(src: Buffer, srcW: number, y0: number, w: number, h: number): Buffer {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcRow = (y0 + y) * srcW * 4;
    const dstRow = y * w * 4;
    src.copy(out, dstRow, srcRow, srcRow + w * 4);
  }
  return out;
}

/**
 * Compare two base64-encoded PNG screenshots (no `data:` prefix) pixel by pixel,
 * producing a fidelity-oriented mismatch fraction.
 *
 * Full-page shots of the original and the clone almost never share dimensions —
 * the original is typically a tall scroll capture while the clone differs in
 * height (and sometimes width). A naive top-left crop to the overlap has two
 * failure modes that make the score actively misleading:
 *
 *   1. **Incompleteness scores high.** A clone that only renders the nav+hero
 *      (a third of the page) gets compared against only that third, so a stub
 *      can score ~99 while a complete clone scores 60. We fix this by scoring
 *      over the *union* height: rows the clone never produced count as fully
 *      mismatched, so coverage is part of the score.
 *   2. **A global vertical shift dominates.** If the hero is a little too short,
 *      every section below is out of registration and the raw diff explodes,
 *      drowning out local fixes so passes barely move the score. We fix this by
 *      comparing in horizontal bands, each free to slide within a small vertical
 *      window to find its best alignment (see BAND_HEIGHT / MAX_OFFSET).
 *
 * `mismatch` = (aligned mismatched pixels in the overlap + pixels in the
 * uncovered tail) / (overlap width × union height). `coverage` reports how much
 * of the taller page the clone spans.
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
  const unionH = Math.max(a.height, b.height);

  // Guard against zero-area inputs: nothing to compare, so report a perfect
  // (0) mismatch with an empty 0x0 diff rather than dividing by zero.
  if (commonW <= 0 || commonH <= 0) {
    return { mismatch: 0, diffPngBase64: "", width: 0, height: 0, coverage: 0 };
  }

  const threshold = options?.threshold ?? 0.1;

  // --- Aligned mismatch over the overlap, band by band ------------------------
  // For each band of the original, slide the clone within ±MAX_OFFSET and keep
  // the lowest mismatch. off=0 is always evaluated, so a band can never score
  // worse than the unaligned comparison.
  let alignedMismatch = 0;
  for (let y = 0; y < commonH; y += BAND_HEIGHT) {
    const h = Math.min(BAND_HEIGHT, commonH - y);
    const origBand = cropRGBA(a.data, a.width, y, commonW, h);
    let best = Number.POSITIVE_INFINITY;
    for (let off = -MAX_OFFSET; off <= MAX_OFFSET; off += OFFSET_STEP) {
      const by = y + off;
      // Only consider offsets that keep the clone band fully in bounds.
      if (by < 0 || by + h > b.height) continue;
      const cloneBand = cropRGBA(b.data, b.width, by, commonW, h);
      // No diff output needed for the alignment search — pass undefined.
      const mm = pixelmatch(origBand, cloneBand, undefined, commonW, h, { threshold });
      if (mm < best) best = mm;
      if (best === 0) break; // perfect band — no better alignment possible
    }
    alignedMismatch += Number.isFinite(best) ? best : commonW * h;
  }

  // --- Completeness penalty: the uncovered tail counts as fully mismatched ----
  const uncoveredTail = commonW * (unionH - commonH);
  const denominator = commonW * unionH;
  const mismatch = (alignedMismatch + uncoveredTail) / denominator;
  const coverage = commonH / unionH;

  // --- Diff visualization (straight overlap comparison, no alignment) ---------
  // The score is alignment-tolerant, but the highlighted image stays a literal
  // top-left overlap diff so it's easy to read what differs and where.
  const aCrop = cropRGBA(a.data, a.width, 0, commonW, commonH);
  const bCrop = cropRGBA(b.data, b.width, 0, commonW, commonH);
  const diff = new PNG({ width: commonW, height: commonH });
  pixelmatch(aCrop, bCrop, diff.data, commonW, commonH, { threshold });
  const diffPngBase64 = PNG.sync.write(diff).toString("base64");

  return { mismatch, diffPngBase64, width: commonW, height: commonH, coverage };
}

/**
 * Map a pixel mismatch fraction (0..1) onto a 0..100 fidelity score, where 100
 * means the clone is pixel-identical and 0 means entirely different.
 */
export function fidelityScore(mismatch: number): number {
  const score = Math.round((1 - mismatch) * 100);
  return Math.max(0, Math.min(100, score));
}
