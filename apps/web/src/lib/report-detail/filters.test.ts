import { describe, expect, test } from "bun:test";
import {
  filterConsoleLogs,
  filterNetworkRows,
  redactBody,
} from "./filters";

describe("report detail filters", () => {
  test("filters console rows by level", () => {
    const rows = [
      { level: "error", payload: ["boom"] },
      { level: "log", payload: ["ok"] },
    ];
    expect(filterConsoleLogs(rows, "error")).toHaveLength(1);
  });

  test("filters network rows by status and host", () => {
    const rows = [
      {
        request: { host: "api.example.com" },
        response: { status: 500 },
      },
      {
        request: { host: "cdn.example.com" },
        response: { status: 200 },
      },
    ];
    expect(filterNetworkRows(rows, "500", "api")).toHaveLength(1);
  });

  test("redacts bearer tokens in response bodies", () => {
    expect(redactBody("Bearer secret-token")).toContain("[REDACTED]");
  });
});
