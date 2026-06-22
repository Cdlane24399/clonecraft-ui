// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildCachedUserContent, EPHEMERAL } from "./ai";

const EPH = { anthropic: { cacheControl: { type: "ephemeral" } } };

describe("EPHEMERAL", () => {
  it("is the Anthropic ephemeral cache-control provider option", () => {
    expect(EPHEMERAL).toEqual(EPH);
  });
});

describe("buildCachedUserContent", () => {
  it("marks the image and the design spec as cached, instructions uncached", () => {
    const parts = buildCachedUserContent({
      imageBase64: "aW1n", // "img"
      designSpec: "# spec",
      instructions: "do the thing",
    });
    // Order: image, spec, instructions.
    expect(parts[0].type).toBe("image");
    expect(parts[0].providerOptions).toEqual(EPH);
    expect(parts[1].type).toBe("text");
    expect(parts[1].text).toContain("# spec");
    expect(parts[1].providerOptions).toEqual(EPH);
    expect(parts[2].type).toBe("text");
    expect(parts[2].text).toBe("do the thing");
    expect(parts[2].providerOptions).toBeUndefined();
  });

  it("omits the spec part entirely when the design spec is empty", () => {
    const parts = buildCachedUserContent({
      imageBase64: "aW1n",
      designSpec: "",
      instructions: "go",
    });
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe("image");
    expect(parts[1].text).toBe("go");
  });
});
