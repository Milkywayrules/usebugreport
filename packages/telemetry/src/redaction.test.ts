import { describe, expect, test } from "bun:test";
import { redactSecrets, redactWideEvent } from "./redaction";

describe("redactSecrets", () => {
  test("redacts authorization and r2Key fields", () => {
    const output = redactSecrets({
      authorization: "Bearer secret",
      r2Key: "org/report/blob",
      title: "ok",
    }) as Record<string, unknown>;

    expect(output.authorization).toBe("[REDACTED]");
    expect(output.r2Key).toBe("[REDACTED]");
    expect(output.title).toBe("ok");
  });

  test("redacts presigned url patterns in strings", () => {
    const output = redactSecrets(
      "https://example.com/file?X-Amz-Signature=abc123"
    );
    expect(output).toBe("[REDACTED]");
  });
});

describe("redactWideEvent", () => {
  test("returns redacted copy without mutating input", () => {
    const event = { ingestKey: "ubr_ingest_x", requestId: "req_1" };
    const redacted = redactWideEvent(event);
    expect(redacted.ingestKey).toBe("[REDACTED]");
    expect(event.ingestKey).toBe("ubr_ingest_x");
  });
});
