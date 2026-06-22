// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedFile, BuildReport } from "../db/schema";

// Mock the model calls (gateway), the pixel diff, and the screenshotter so the
// test exercises ONLY the loop's control flow — convergence, accept/reject of
// rebuilds, and cost-avoidance — without any network or browser.
vi.mock("./ai", () => ({
  judgeVisualDifferences: vi.fn(),
  fixVisualFidelity: vi.fn(),
}));
vi.mock("./browser", () => ({
  screenshotUrl: vi.fn(async () => "rendered-shot-b64"),
}));
// Keep the real fidelityScore (pure), mock only computePixelDiff.
vi.mock("./visualDiff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./visualDiff")>();
  return { ...actual, computePixelDiff: vi.fn() };
});

import { runFidelityLoop } from "./fidelity";
import { judgeVisualDifferences, fixVisualFidelity } from "./ai";
import { screenshotUrl } from "./browser";
import { computePixelDiff } from "./visualDiff";

const judgeMock = vi.mocked(judgeVisualDifferences);
const fixMock = vi.mocked(fixVisualFidelity);
const screenshotMock = vi.mocked(screenshotUrl);
const diffMock = vi.mocked(computePixelDiff);

/** A fake re-buildable session whose build() result we control per call. */
function fakeSession(results: BuildReport[]) {
  const calls: GeneratedFile[][] = [];
  let i = 0;
  return {
    calls,
    session: {
      async build(files: GeneratedFile[]): Promise<BuildReport> {
        calls.push(files);
        return results[i++] ?? { ran: true, passed: true, output: "ok" };
      },
    },
  };
}

const PASS: BuildReport = { ran: true, passed: true, output: "ok" };
const FAIL: BuildReport = { ran: true, passed: false, output: "boom" };

// A diff result with the given mismatch (fidelityScore = round((1-mismatch)*100)).
const diff = (mismatch: number) => ({ mismatch, diffPngBase64: "diff-b64", width: 10, height: 10 });

const baseParams = () => ({
  files: [{ path: "src/App.tsx", content: "old\n" }],
  originalScreenshotBase64: "orig-b64",
  renderedScreenshotBase64: "render-b64",
  previewUrl: "https://preview.example",
  designSpec: "# spec",
  system: "you are an engineer",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runFidelityLoop", () => {
  it("stops immediately (no judge/fix calls) when the initial score already meets target", async () => {
    diffMock.mockReturnValue(diff(0.02)); // score 98 >= 92
    const { session } = fakeSession([]);

    const res = await runFidelityLoop({ ...baseParams(), session });

    expect(judgeMock).not.toHaveBeenCalled();
    expect(fixMock).not.toHaveBeenCalled();
    expect(res.fidelity.passes).toBe(0);
    expect(res.fidelity.score).toBe(98);
    expect(res.files).toEqual(baseParams().files); // unchanged
  });

  it("stops when the judge reports no differences, even if below target", async () => {
    diffMock.mockReturnValue(diff(0.4)); // score 60 < 92
    judgeMock.mockResolvedValue({ differences: [] });
    const { session } = fakeSession([]);

    const res = await runFidelityLoop({ ...baseParams(), session });

    expect(judgeMock).toHaveBeenCalledTimes(1);
    expect(fixMock).not.toHaveBeenCalled();
    expect(res.fidelity.passes).toBe(0);
    expect(res.fidelity.score).toBe(60);
  });

  it("applies a refinement pass and converges, updating files + score", async () => {
    // Initial diff 0.40 (score 60), after pass 1 → 0.05 (score 95, hits target).
    diffMock.mockReturnValueOnce(diff(0.4)).mockReturnValueOnce(diff(0.05));
    judgeMock.mockResolvedValue({
      differences: [{ area: "hero", issue: "font too small", severity: "high" }],
    });
    fixMock.mockResolvedValue("```tsx file=src/App.tsx\nnew improved\n```");
    const { session, calls } = fakeSession([PASS]);

    const res = await runFidelityLoop({ ...baseParams(), session });

    expect(fixMock).toHaveBeenCalledTimes(1);
    expect(screenshotMock).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1); // one rebuild
    expect(res.fidelity.passes).toBe(1);
    expect(res.fidelity.score).toBe(95);
    expect(res.files[0].content).toContain("new improved"); // accepted the fix
    expect(res.renderedScreenshotBase64).toBe("rendered-shot-b64");
  });

  it("discards a fix that breaks the build and keeps the previous version (passes stays 0)", async () => {
    diffMock.mockReturnValue(diff(0.4)); // stays low; would keep looping if not for the failed build
    judgeMock.mockResolvedValue({
      differences: [{ area: "nav", issue: "missing CTA", severity: "high" }],
    });
    fixMock.mockResolvedValue("```tsx file=src/App.tsx\nbroken code\n```");
    const { session } = fakeSession([FAIL]);

    const res = await runFidelityLoop({ ...baseParams(), session });

    expect(fixMock).toHaveBeenCalledTimes(1);
    expect(screenshotMock).not.toHaveBeenCalled(); // never re-screenshot after a failed build
    expect(res.fidelity.passes).toBe(0); // failed attempt is NOT counted
    expect(res.files[0].content).toBe("old\n"); // original kept
  });

  it("never exceeds MAX_FIDELITY_PASSES when the clone keeps differing", async () => {
    diffMock.mockReturnValue(diff(0.5)); // score 50, always below target
    judgeMock.mockResolvedValue({
      differences: [{ area: "footer", issue: "wrong color", severity: "medium" }],
    });
    fixMock.mockResolvedValue("```tsx file=src/App.tsx\ntweak\n```");
    const { session, calls } = fakeSession([PASS, PASS, PASS, PASS]);

    const res = await runFidelityLoop({ ...baseParams(), session });

    // MAX_FIDELITY_PASSES is 2 → at most 2 rebuilds / fix calls.
    expect(calls.length).toBeLessThanOrEqual(2);
    expect(fixMock.mock.calls.length).toBeLessThanOrEqual(2);
    expect(res.fidelity.passes).toBeLessThanOrEqual(2);
  });

  it("reports the diff image and pixel mismatch in the final report", async () => {
    diffMock.mockReturnValue(diff(0.02));
    const { session } = fakeSession([]);

    const res = await runFidelityLoop({ ...baseParams(), session });

    expect(res.fidelity.pixelMismatch).toBeCloseTo(0.02);
    expect(res.fidelity.diffImageDataUrl).toBe("data:image/png;base64,diff-b64");
  });

  it("forwards progress + log callbacks", async () => {
    diffMock.mockReturnValueOnce(diff(0.4)).mockReturnValueOnce(diff(0.05));
    judgeMock.mockResolvedValue({
      differences: [{ area: "hero", issue: "x", severity: "low" }],
    });
    fixMock.mockResolvedValue("```tsx file=src/App.tsx\ny\n```");
    const { session } = fakeSession([PASS]);
    const emit = vi.fn();
    const log = vi.fn();

    await runFidelityLoop({ ...baseParams(), session, emit, log });

    expect(emit).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });
});
