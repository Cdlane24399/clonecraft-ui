// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseGeneratedFiles, isLikelyTruncated } from "./codegenFiles";

describe("isLikelyTruncated", () => {
  it("is false for balanced fenced blocks", () => {
    const md = "```tsx file=src/App.tsx\nexport default () => null;\n```";
    expect(isLikelyTruncated(md)).toBe(false);
  });

  it("is true for an unterminated final block (odd fence count)", () => {
    const md =
      "```tsx file=src/App.tsx\nexport default () => null;\n```\n\n" +
      "```tsx file=src/Hero.tsx\nexport function Hero() { return (";
    expect(isLikelyTruncated(md)).toBe(true);
  });

  it("is false for empty output (nothing to continue)", () => {
    expect(isLikelyTruncated("")).toBe(false);
  });
});

describe("parseGeneratedFiles (regression)", () => {
  it("still parses balanced blocks", () => {
    const md = "```tsx file=src/App.tsx\nhi\n```";
    expect(parseGeneratedFiles(md)).toEqual([{ path: "src/App.tsx", content: "hi\n" }]);
  });
});
