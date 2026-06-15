// Vitest setup. Runs in both jsdom and node environments; only do work
// that's safe in both.
import "@testing-library/jest-dom";

// jsdom doesn't ship a matchMedia implementation; many component libraries
// call it during render. This shim is a no-op in node (window undefined).
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
