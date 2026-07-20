import { describe, expect, test } from "bun:test";
import type { NetworkRequest } from "@rrweb/types";
import {
  defaultIgnoreRequestFn,
  REDACTED,
  redactHeaders,
  sanitizeNetworkRequest,
  shouldIgnoreRequest,
  TRUNCATED_MARKER,
  truncateBody,
} from "../plugins/network";

describe("network redaction", () => {
  test("redacts Authorization header", () => {
    const headers = redactHeaders({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    });
    expect(headers?.Authorization).toBe(REDACTED);
    expect(headers?.["Content-Type"]).toBe("application/json");
  });

  test("redacts cookie headers", () => {
    const headers = redactHeaders({
      cookie: "session=abc123",
      "set-cookie": "session=abc123; HttpOnly",
    });
    expect(headers?.cookie).toBe(REDACTED);
    expect(headers?.["set-cookie"]).toBe(REDACTED);
  });

  test("truncates 40 KB body to 32 KB with marker", () => {
    const body = "x".repeat(40 * 1024);
    const truncated = truncateBody(body, 32_768);
    expect(truncated).toContain(TRUNCATED_MARKER);
    expect(
      new TextEncoder().encode(truncated ?? "").length
    ).toBeLessThanOrEqual(32_768 + TRUNCATED_MARKER.length + 4);
  });

  test("sanitizeNetworkRequest applies header and body rules", () => {
    const request: NetworkRequest = {
      name: "https://api.example.com/data",
      requestBody: "a".repeat(40 * 1024),
      requestHeaders: { Authorization: "Bearer x" },
      responseBody: "ok",
      responseHeaders: { "set-cookie": "a=b" },
    };
    const sanitized = sanitizeNetworkRequest(request, 32_768);
    expect(sanitized?.requestHeaders?.Authorization).toBe(REDACTED);
    expect(sanitized?.responseHeaders?.["set-cookie"]).toBe(REDACTED);
    expect(sanitized?.requestBody).toContain(TRUNCATED_MARKER);
  });
});

describe("ignoreRequestFn", () => {
  test("excludes ingest URLs by default", () => {
    expect(
      defaultIgnoreRequestFn("https://app.example.com/api/v1/capture/inline")
    ).toBe(true);
    expect(defaultIgnoreRequestFn("https://app.example.com/api/v1/other")).toBe(
      false
    );
  });

  test("allows integrator override", () => {
    expect(
      shouldIgnoreRequest("https://app.example.com/custom", {
        ignoreRequestFn: (url) => url.includes("custom"),
      })
    ).toBe(true);
  });
});
