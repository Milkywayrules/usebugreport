import { describe, expect, test } from "bun:test";
import { CAPTURE_CORE_VERSION, createRecorder, SDK_VERSION } from "./index";

describe("@usebugreport/browser", () => {
  test("re-exports capture-core recorder API", () => {
    expect(CAPTURE_CORE_VERSION).toBe("0.1.0");
    expect(typeof createRecorder).toBe("function");
    expect(SDK_VERSION).toBe("0.0.0-stub");
  });
});
