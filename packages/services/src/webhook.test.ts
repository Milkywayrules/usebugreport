import { describe, expect, test } from "bun:test";
import { buildWebhookSignature, webhookTimestampSeconds } from "./webhook-sign";
import { WEBHOOK_LAUNCH_EVENTS } from "./webhook";

describe("webhook service constants", () => {
  test("launch events include report.created and report.updated", () => {
    expect(WEBHOOK_LAUNCH_EVENTS).toContain("report.created");
    expect(WEBHOOK_LAUNCH_EVENTS).toContain("report.updated");
  });
});

describe("webhook HMAC signing", () => {
  test("buildWebhookSignature is deterministic for timestamp and body", () => {
    const ts = webhookTimestampSeconds(new Date("2026-07-20T00:00:00.000Z"));
    const body = JSON.stringify({ type: "report.created" });
    const a = buildWebhookSignature("secret", ts, body);
    const b = buildWebhookSignature("secret", ts, body);
    expect(a).toBe(b);
    expect(a.startsWith("sha256=")).toBe(true);
  });
});
