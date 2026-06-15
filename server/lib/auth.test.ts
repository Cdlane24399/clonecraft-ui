// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requireAuth, getUserId } from "./auth";

// We mock the clerk module so the auth helpers think there's either a user
// or there isn't, without booting a real Hono app.
vi.mock("./clerk", () => ({
  readUserId: (c: { get: (k: string) => { userId?: string } | undefined }) =>
    c.get("auth")?.userId ?? null,
}));

function makeApp(authed: boolean) {
  const app = new Hono();
  // Fake the auth context that clerkMiddleware would set in production.
  app.use("*", async (c, next) => {
    c.set("auth" as never, authed ? { userId: "user_test_123" } : undefined);
    await next();
  });
  app.get("/protected", requireAuth(), (c) => {
    return c.json({ userId: getUserId(c) });
  });
  return app;
}

describe("requireAuth", () => {
  it("returns 401 when no Clerk session", async () => {
    const app = makeApp(false);
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
  });

  it("returns the userId when authenticated", async () => {
    const app = makeApp(true);
    const res = await app.request("/protected");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ userId: "user_test_123" });
  });

  it("getUserId throws a 401 Response when unauthenticated", () => {
    // Simulate the auth helper: it has to throw a Response, not an Error,
    // because Hono only renders thrown Response objects as replies.
    const fakeContext = { get: () => undefined } as never;
    expect(() => getUserId(fakeContext)).toThrow();
  });
});
