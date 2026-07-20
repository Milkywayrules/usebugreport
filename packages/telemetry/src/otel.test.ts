import { afterEach, describe, expect, test } from "bun:test";
import { initTelemetry, isOtelEnabled, shutdownTelemetry } from "./otel";

const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

afterEach(() => {
  if (originalEndpoint === undefined) {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  } else {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
  }
});

describe("otel disabled", () => {
  test("init and shutdown do not throw when endpoint unset", async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(isOtelEnabled()).toBe(false);
    await initTelemetry();
    await shutdownTelemetry();
  });
});
