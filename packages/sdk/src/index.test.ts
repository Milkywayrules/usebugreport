import { describe, expect, test } from "bun:test";
import { CAPTURE_CORE_VERSION, SDK_VERSION } from "./index";

describe("@usebugreport/browser", () => {
  test("re-exports capture-core stub", () => {
    expect(CAPTURE_CORE_VERSION).toBe("0.0.0-stub");
    expect(SDK_VERSION).toBe("0.0.0-stub");
  });
});
