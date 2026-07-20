import { describe, expect, test } from "bun:test";
import { app } from "../index";

describe("platform openapi", () => {
  test("public spec excludes health, probes, session, and onboarding routes", async () => {
    const response = await app.handle(
      new Request("http://localhost/openapi.json")
    );
    expect(response.status).toBe(200);

    const spec = (await response.json()) as { paths?: Record<string, unknown> };
    const paths = Object.keys(spec.paths ?? {});

    expect(paths).not.toContain("/health");
    expect(paths).not.toContain("/api/v1/session");
    expect(paths).not.toContain("/api/v1/onboarding/workspace");
    expect(paths).not.toContain("/api/v1/protected-probe");
    expect(paths).not.toContain("/api/v1/auth/context-probe");
    expect(paths.some((path) => path.includes("scope-probe"))).toBe(false);
  });

  test("openapi json alias serves filtered document", async () => {
    const response = await app.handle(
      new Request("http://localhost/openapi/json")
    );
    expect([301, 302, 307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toBe("/openapi.json");
  });
});
