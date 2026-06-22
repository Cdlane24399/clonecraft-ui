import { PNG } from "pngjs";

// Default long-edge cap. Anthropic resizes images whose long edge exceeds
// ~1568px before tokenizing, so capping at 1536 keeps us at/under that bound
// while controlling the downscale quality ourselves and shrinking the payload.
const DEFAULT_MAX_LONG_EDGE = 1536;

/**
 * Downscale a base64 PNG (no `data:` prefix) so its longest edge is within
 * `maxLongEdge`, preserving aspect ratio. Used ONLY for the vision/judge/fix
 * image parts — the pixel diff keeps the full-resolution capture. Best-effort:
 * if the image is already small enough or can't be decoded, the input is
 * returned unchanged so callers never break on a bad screenshot.
 */
export function compressForVision(
  base64png: string,
  maxLongEdge: number = DEFAULT_MAX_LONG_EDGE
): string {
  let src: PNG;
  try {
    src = PNG.sync.read(Buffer.from(base64png, "base64"));
  } catch {
    return base64png;
  }
  const longEdge = Math.max(src.width, src.height);
  if (longEdge <= maxLongEdge) return base64png;

  const scale = maxLongEdge / longEdge;
  const dstW = Math.max(1, Math.round(src.width * scale));
  const dstH = Math.max(1, Math.round(src.height * scale));
  const dst = new PNG({ width: dstW, height: dstH });

  // Box-average downscale: each destination pixel averages the source block it
  // maps to. Cheap, dependency-free, and good enough for a vision model.
  const xRatio = src.width / dstW;
  const yRatio = src.height / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy0 = Math.floor(y * yRatio);
    const sy1 = Math.min(src.height, Math.floor((y + 1) * yRatio) || sy0 + 1);
    for (let x = 0; x < dstW; x++) {
      const sx0 = Math.floor(x * xRatio);
      const sx1 = Math.min(src.width, Math.floor((x + 1) * xRatio) || sx0 + 1);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * src.width + sx) * 4;
          r += src.data[i]; g += src.data[i + 1];
          b += src.data[i + 2]; a += src.data[i + 3];
          n++;
        }
      }
      const di = (y * dstW + x) * 4;
      dst.data[di] = Math.round(r / n);
      dst.data[di + 1] = Math.round(g / n);
      dst.data[di + 2] = Math.round(b / n);
      dst.data[di + 3] = Math.round(a / n);
    }
  }
  return PNG.sync.write(dst).toString("base64");
}
