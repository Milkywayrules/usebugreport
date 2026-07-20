import "./test/preload.ts";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import {
  dispose,
  init,
  SDK_VERSION,
  submit,
  UseBugReportConfigError,
  UseBugReportNotInitializedError,
  useBugReport,
} from "./index";
import { INGEST_KEY_PREFIX, MIN_INGEST_KEY_LENGTH } from "./validate";

const VALID_KEY = `${INGEST_KEY_PREFIX}${"a".repeat(MIN_INGEST_KEY_LENGTH - INGEST_KEY_PREFIX.length)}`;
const hasCompressionStream = typeof CompressionStream !== "undefined";
const ALREADY_INITIALIZED_PATTERN = /already initialized/;
const INIT_REQUIRED_PATTERN = /init\(\)/;

async function gunzipJson(blob: Blob): Promise<unknown> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const json = gunzipSync(buffer);
  return JSON.parse(json.toString("utf8"));
}

function mockScreenshotCapture(): void {
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
}

afterEach(() => {
  dispose();
  mock.restore();
});

describe("@usebugreport/browser public API", () => {
  test("exports SDK version and useBugReport namespace", () => {
    expect(SDK_VERSION).toBe("0.1.0");
    expect(useBugReport.init).toBe(init);
    expect(useBugReport.submit).toBe(submit);
    expect(useBugReport.dispose).toBe(dispose);
  });

  test("does not re-export capture-core symbols", async () => {
    const mod = await import("./index");
    expect("createRecorder" in mod).toBe(false);
    expect("assembleSubmitPayload" in mod).toBe(false);
    expect("CAPTURE_CORE_VERSION" in mod).toBe(false);
  });
});

describe("init", () => {
  test("throws UseBugReportConfigError for invalid projectKey before recording", () => {
    expect(() => init({ projectKey: "invalid" })).toThrow(
      UseBugReportConfigError
    );
  });

  test("throws when already initialized", () => {
    init({ projectKey: VALID_KEY });
    expect(() => init({ projectKey: VALID_KEY })).toThrow(
      UseBugReportConfigError
    );
    expect(() => init({ projectKey: VALID_KEY })).toThrow(
      ALREADY_INITIALIZED_PATTERN
    );
  });

  test.skipIf(!hasCompressionStream)(
    "starts recorder and accepts mapped metadata provider",
    async () => {
      document.body.innerHTML = "<div>sdk init test</div>";
      mockScreenshotCapture();

      init({
        metadata: () => ({ appVersion: "1.2.3" }),
        projectKey: VALID_KEY,
      });

      const result = await submit({ title: "Init smoke" });
      expect(result.projectKey).toBe(VALID_KEY);
      expect(result.payload.parts.meta.json.custom?.appVersion).toBe("1.2.3");
    },
    15_000
  );
});

describe("submit", () => {
  test("throws UseBugReportNotInitializedError before init", async () => {
    await expect(submit({ title: "orphan" })).rejects.toThrow(
      UseBugReportNotInitializedError
    );
    await expect(submit({ title: "orphan" })).rejects.toThrow(
      INIT_REQUIRED_PATTERN
    );
  });

  test("throws after dispose", async () => {
    init({ projectKey: VALID_KEY });
    dispose();
    await expect(submit({ title: "after dispose" })).rejects.toThrow(
      UseBugReportNotInitializedError
    );
  });

  test.skipIf(!hasCompressionStream)(
    "returns SubmitResult with gzip parts and merged custom metadata",
    async () => {
      document.body.innerHTML = "<div id='sdk-app'>submit flow</div>";
      mockScreenshotCapture();

      let callbackResult: Awaited<ReturnType<typeof submit>> | undefined;
      init({
        onSubmit: (submitResult) => {
          callbackResult = submitResult;
        },
        projectKey: VALID_KEY,
      });

      const result = await submit({
        description: "Button does nothing",
        title: "Broken checkout",
      });

      expect(result.projectKey).toBe(VALID_KEY);
      expect(result.title).toBe("Broken checkout");
      expect(result.description).toBe("Button does nothing");
      expect(callbackResult).toEqual(result);

      expect(result.payload.parts.replay).toHaveLength(1);
      expect(result.payload.parts.console.name).toBe("console.json.gz");
      expect(result.payload.parts.network.name).toBe("network.json.gz");
      expect(result.payload.parts.meta.contentType).toBe("application/json");
      expect(result.payload.parts.meta.json.custom?.title).toBe(
        "Broken checkout"
      );
      expect(result.payload.parts.meta.json.custom?.description).toBe(
        "Button does nothing"
      );

      const [replayPart] = result.payload.parts.replay;
      expect(replayPart).toBeDefined();
      if (!replayPart) {
        throw new Error("expected replay part");
      }

      const replayBytes = new Uint8Array(await replayPart.blob.arrayBuffer());
      expect(replayBytes[0]).toBe(0x1f);
      expect(replayBytes[1]).toBe(0x8b);

      const replayData = (await gunzipJson(replayPart.blob)) as {
        events: unknown[];
      };
      expect(Array.isArray(replayData.events)).toBe(true);
    },
    15_000
  );
});
