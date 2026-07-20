import { describe, expect, test } from "bun:test";
import type { CaptureSubmitPayload } from "@usebugreport/capture-core";
import { UseBugReportIngestError, uploadCapturePayload } from "./ingest-client";

function makePayload(byteLength = 32): CaptureSubmitPayload {
  const blob = new Blob([new Uint8Array(byteLength)], {
    type: "application/octet-stream",
  });
  const gzipBlob = {
    blob,
    byteLength,
    contentType: "application/gzip" as const,
    name: "console.json.gz",
  };

  return {
    assembledAt: new Date().toISOString(),
    bufferSeconds: 30,
    parts: {
      console: gzipBlob,
      meta: {
        blob: new Blob(["{}"], { type: "application/json" }),
        contentType: "application/json",
        json: { url: "https://example.com" },
      },
      network: { ...gzipBlob, name: "network.json.gz" },
      replay: [{ ...gzipBlob, name: "replay/batch-0.json.gz", seq: 0 }],
      screenshot: null,
    },
    snapshot: {
      console: [],
      exportedAt: new Date().toISOString(),
      network: [],
      replayEvents: [],
    },
  };
}

describe("uploadCapturePayload", () => {
  test("uses inline ingest for small payloads", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input, init) => {
      expect(String(input)).toContain("/api/v1/capture/ingest");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "X-Ingest-Key": "ubr_ingest_test",
      });
      return Promise.resolve(
        new Response(JSON.stringify({ reportId: "rpt_inline_1" }), {
          status: 202,
        })
      );
    }) as typeof fetch;

    try {
      const result = await uploadCapturePayload({
        apiBaseUrl: "https://api.test",
        payload: makePayload(16),
        projectKey: "ubr_ingest_test",
        title: "Bug",
      });
      expect(result.reportId).toBe("rpt_inline_1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 429 responses to UseBugReportIngestError", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { code: "QUOTA_EXCEEDED", message: "Monthly quota reached." },
        }),
        { status: 429 }
      )) as typeof fetch;

    try {
      await expect(
        uploadCapturePayload({
          apiBaseUrl: "https://api.test",
          payload: makePayload(16),
          projectKey: "ubr_ingest_test",
          title: "Bug",
        })
      ).rejects.toBeInstanceOf(UseBugReportIngestError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
