import { describe, expect, test } from "bun:test";
import {
  assembleSubmitPayload,
  CAPTURE_CORE_VERSION,
  collectEnvironmentMetadata,
  createRecorder,
  SDK_VERSION,
} from "./index";

describe("@usebugreport/browser", () => {
  test("re-exports capture-core recorder API", () => {
    expect(CAPTURE_CORE_VERSION).toBe("0.2.0");
    expect(typeof createRecorder).toBe("function");
    expect(typeof assembleSubmitPayload).toBe("function");
    expect(typeof collectEnvironmentMetadata).toBe("function");
    expect(SDK_VERSION).toBe("0.0.0-stub");
  });
});
