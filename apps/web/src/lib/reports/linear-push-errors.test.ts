import { describe, expect, test } from "bun:test";
import { isLinearTokenExpiredMessage } from "./linear-push-errors";

describe("linear push errors", () => {
  test("detects token refresh failures", () => {
    expect(isLinearTokenExpiredMessage("Linear token refresh failed.")).toBe(true);
    expect(isLinearTokenExpiredMessage("network error")).toBe(false);
  });
});
