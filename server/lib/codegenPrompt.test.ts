// @vitest-environment node
import { describe, it, expect } from "vitest";
import { CODEGEN_SYSTEM, buildCodegenPrompt, STACK_LABEL } from "./codegenPrompt";

describe("CODEGEN_SYSTEM", () => {
  it("frames the model as a verbatim converter with explicit copy rules", () => {
    const sys = CODEGEN_SYSTEM("react");
    expect(sys).toMatch(/CONVERTER/i);
    expect(sys).toMatch(/word[- ]for[- ]word/i);
    expect(sys).toMatch(/lorem ipsum/i); // forbids placeholder copy
    expect(sys).toMatch(/example\.com/i); // forbids placeholder URLs
    // Keeps the existing z-index / gradient guidance.
    expect(sys).toMatch(/z-0|z-\[0\]/);
  });

  it("allows real images through the preview proxy", () => {
    const sys = CODEGEN_SYSTEM("react");
    expect(sys).toContain("/proxy-image?url=");
  });
});

describe("buildCodegenPrompt", () => {
  const base = {
    stack: "react" as const,
    goal: "recreate" as const,
    passList: [],
    designSpec: "# Measured design system\naccent #2563eb",
    tokens: { colors: [{ name: "accent", value: "#2563eb" }], fonts: ["Inter"] },
    brief: "",
    components: [{ name: "Navbar" }, { name: "Hero" }],
    pageText: "Ship faster with Acme. Start your free trial today.",
  };

  it("includes the captured page text as source-of-truth copy", () => {
    const p = buildCodegenPrompt(base);
    expect(p).toContain("Ship faster with Acme");
  });

  it("includes the design spec when present and the stack label", () => {
    const p = buildCodegenPrompt(base);
    expect(p).toContain("Measured design system");
    expect(p).toContain(STACK_LABEL.react);
  });

  it("falls back to inline token list when no design spec", () => {
    const p = buildCodegenPrompt({ ...base, designSpec: "" });
    expect(p).toContain("#2563eb"); // color value still conveyed
    expect(p).toContain("Inter");
  });
});
