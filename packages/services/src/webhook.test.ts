import { describe, expect, test } from "bun:test";
import { WEBHOOK_LAUNCH_EVENTS } from "./webhook";

describe("webhook service constants", () => {
  test("launch events include report lifecycle", () => {
    expect(WEBHOOK_LAUNCH_EVENTS).toContain("report.created");
    expect(WEBHOOK_LAUNCH_EVENTS).toContain("report.updated");
  });
});
