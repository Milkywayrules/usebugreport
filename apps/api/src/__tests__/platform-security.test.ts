import { describe, expect, test } from "bun:test";
import { app } from "../index";

describe("platform security", () => {
  test("representative API response includes helmet nosniff header", async () => {
    const response = await app.handle(new Request("http://localhost/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});
