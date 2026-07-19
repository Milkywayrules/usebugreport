import { describe, expect, test } from "bun:test";
import { CAPTURE_CORE_VERSION } from "./index";

describe("@usebugreport/capture-core", () => {
  test("exports placeholder version", () => {
    expect(CAPTURE_CORE_VERSION).toBe("0.0.0-stub");
  });
});
