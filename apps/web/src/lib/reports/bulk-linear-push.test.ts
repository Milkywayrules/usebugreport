import { describe, expect, test } from "bun:test";
import { bulkPushReportsToLinear } from "./bulk-linear-push";

describe("bulkPushReportsToLinear", () => {
  test("aggregates per-report results", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/linear/push")) {
        if (url.includes("fail")) {
          return new Response(
            JSON.stringify({ error: { message: "boom" } }),
            { status: 422 }
          );
        }
        return new Response(
          JSON.stringify({ data: { operationId: "iop_1", status: "pending" } }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    try {
      const summary = await bulkPushReportsToLinear(["rpt_ok", "rpt_fail"]);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.failedIds).toEqual(["rpt_fail"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
