import "./test/preload.ts";
import { describe, expect, mock, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { createRecorder } from "./record";
import { assembleSubmitPayload, gzipJson } from "./submit-payload";

const hasCompressionStream = typeof CompressionStream !== "undefined";

async function gunzipJson(blob: Blob): Promise<unknown> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const json = gunzipSync(buffer);
  return JSON.parse(json.toString("utf8"));
}

describe("gzipJson", () => {
  test.skipIf(!hasCompressionStream)("produces gzip magic bytes", async () => {
    const blob = await gzipJson({ hello: "world" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    expect(blob.type).toBe("application/gzip");
  });

  test("throws when CompressionStream unavailable", async () => {
    const original = globalThis.CompressionStream;
    try {
      // @ts-expect-error test override
      globalThis.CompressionStream = undefined;
      await expect(gzipJson({ a: 1 })).rejects.toThrow(/CompressionStream/);
    } finally {
      globalThis.CompressionStream = original;
    }
  });
});

describe("assembleSubmitPayload", () => {
  test.skipIf(!hasCompressionStream)(
    "includes replay, console, network, meta, and screenshot parts",
    async () => {
      document.body.innerHTML = "<div id='app'>submit test</div>";
      const recorder = createRecorder({ bufferSeconds: 60 });

      mock.module("html-to-image", () => ({
        toCanvas: () => {
          const c = document.createElement("canvas");
          c.width = 10;
          c.height = 10;
          c.toBlob = (cb: BlobCallback, type?: string) => {
            cb(new Blob(["x"], { type: type ?? "image/webp" }));
          };
          return Promise.resolve(c);
        },
      }));

      const { assembleSubmitPayload: assembleFresh } = await import(
        "./submit-payload?assembly=1"
      );

      try {
        const payload = await assembleFresh(recorder);

        expect(payload.assembledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(payload.bufferSeconds).toBe(60);
        expect(payload.snapshot.replay).toBeDefined();
        expect(payload.parts.replay).toHaveLength(1);
        expect(payload.parts.replay[0]?.name).toBe("replay/batch-0.json.gz");
        expect(payload.parts.replay[0]?.contentType).toBe("application/gzip");
        expect(payload.parts.console.name).toBe("console.json.gz");
        expect(payload.parts.network.name).toBe("network.json.gz");
        expect(payload.parts.meta.contentType).toBe("application/json");
        expect(payload.parts.meta.json.url).toBe(window.location.href);
        expect(payload.parts.screenshot?.contentType).toBe("image/webp");

        const replayBytes = new Uint8Array(
          await payload.parts.replay[0]!.blob.arrayBuffer()
        );
        expect(replayBytes[0]).toBe(0x1f);
        expect(replayBytes[1]).toBe(0x8b);

        const replayData = (await gunzipJson(
          payload.parts.replay[0]!.blob
        )) as {
          events: unknown[];
        };
        expect(Array.isArray(replayData.events)).toBe(true);

        const metaRoundTrip = JSON.parse(
          await payload.parts.meta.blob.text()
        ) as { url: string };
        expect(metaRoundTrip.url).toBe(payload.parts.meta.json.url);
      } finally {
        mock.restore();
        recorder.dispose();
      }
    },
    15_000
  );

  test.skipIf(!hasCompressionStream)(
    "captureScreenshot false omits screenshot part",
    async () => {
      const recorder = createRecorder({
        bufferSeconds: 60,
        captureScreenshot: false,
      });

      const payload = await assembleSubmitPayload(recorder);
      expect(payload.parts.screenshot).toBeNull();
      expect(payload.parts.replay[0]?.contentType).toBe("application/gzip");

      recorder.dispose();
    },
    10_000
  );

  test("throws outside browser environment", async () => {
    const originalWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: undefined,
        writable: true,
      });
      const { assembleSubmitPayload: assemble } = await import(
        "./submit-payload"
      );
      const fakeRecorder = {
        dispose: () => {},
        exportSnapshot: () => ({
          bufferSeconds: 60,
          console: { events: [] },
          exportedAt: new Date().toISOString(),
          network: { events: [] },
          replay: { eventCount: 0, events: [] },
        }),
        getBufferSeconds: () => 60,
        getResolvedConfig: () => ({
          blockClass: "ubr-block",
          bufferSeconds: 60,
          captureConsole: true,
          captureNetwork: true,
          captureScreenshot: true,
          networkBodyMaxBytes: 32_768,
          screenshotMode: "viewport" as const,
        }),
        stop: () => {},
      };
      await expect(assemble(fakeRecorder)).rejects.toThrow(
        /browser environment/
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
        writable: true,
      });
    }
  });
});
