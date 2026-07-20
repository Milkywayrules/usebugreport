import { describe, expect, test } from "bun:test";
import { LINEAR_PUSH_ACTION } from "./integration-linear-push";

describe("integration linear push", () => {
  test("linear push action constant", () => {
    expect(LINEAR_PUSH_ACTION).toBe("linear.push");
  });
});
