import { collectEnvironmentMetadata } from "./metadata";
import { captureScreenshot } from "./screenshot";
import type {
  AssembleSubmitPayloadOptions,
  CaptureSubmitPayload,
  GzipBlobPart,
  Recorder,
  ResolvedCaptureCoreConfig,
} from "./types";

/** Fallback when CompressionStream is unavailable (document for integrators). */
export const GZIP_FALLBACK_MESSAGE =
  "gzip compression requires CompressionStream (modern browsers; not available in happy-dom)";

/**
 * Gzip JSON using browser-native CompressionStream (no Node zlib in runtime paths).
 */
export async function gzipJson(value: unknown): Promise<Blob> {
  if (typeof CompressionStream === "undefined") {
    throw new Error(GZIP_FALLBACK_MESSAGE);
  }

  const input = new TextEncoder().encode(JSON.stringify(value));
  const compression = new CompressionStream("gzip");

  const writer = compression.writable.getWriter();
  await writer.write(input);
  await writer.close();

  const compressed = await new Response(compression.readable).blob();
  return new Blob([await compressed.arrayBuffer()], {
    type: "application/gzip",
  });
}

async function toGzipPart(
  name: string,
  value: unknown,
  seq?: number
): Promise<GzipBlobPart> {
  const blob = await gzipJson(value);
  return {
    blob,
    byteLength: blob.size,
    contentType: "application/gzip",
    name,
    ...(seq === undefined ? {} : { seq }),
  };
}

function mergeConfig(
  recorder: Recorder,
  override?: AssembleSubmitPayloadOptions["config"]
): ResolvedCaptureCoreConfig {
  const base = recorder.getResolvedConfig();
  if (!override) {
    return base;
  }
  return {
    ...base,
    ...override,
    blockClass: override.blockClass ?? base.blockClass,
    bufferSeconds: override.bufferSeconds ?? base.bufferSeconds,
    captureConsole: override.captureConsole ?? base.captureConsole,
    captureNetwork: override.captureNetwork ?? base.captureNetwork,
    captureScreenshot: override.captureScreenshot ?? base.captureScreenshot,
    networkBodyMaxBytes:
      override.networkBodyMaxBytes ?? base.networkBodyMaxBytes,
    screenshotMode: override.screenshotMode ?? base.screenshotMode,
  };
}

/**
 * Assemble submit payload: BufferSnapshot + gzipped parts + screenshot + metadata (FR-1, FR-3).
 */
export async function assembleSubmitPayload(
  recorder: Recorder,
  options: AssembleSubmitPayloadOptions = {}
): Promise<CaptureSubmitPayload> {
  if (typeof window === "undefined") {
    throw new Error(
      "assembleSubmitPayload requires a browser environment (window is undefined)"
    );
  }

  const config = mergeConfig(recorder, options.config);
  const snapshot = recorder.exportSnapshot(options);

  const [replayParts, consolePart, networkPart, metadata, screenshotResult] =
    await Promise.all([
      toGzipPart(
        "replay/batch-0.json.gz",
        { events: snapshot.replay.events },
        0
      ).then((part) => [part]),
      toGzipPart("console.json.gz", snapshot.console),
      toGzipPart("network.json.gz", snapshot.network),
      collectEnvironmentMetadata({ metadataProvider: config.metadataProvider }),
      captureScreenshot(config),
    ]);

  const metaJson = metadata;
  const metaBlob = new Blob([JSON.stringify(metaJson)], {
    type: "application/json",
  });

  return {
    assembledAt: new Date().toISOString(),
    bufferSeconds: snapshot.bufferSeconds,
    parts: {
      console: consolePart,
      meta: {
        blob: metaBlob,
        contentType: "application/json",
        json: metaJson,
      },
      network: networkPart,
      replay: replayParts,
      screenshot: screenshotResult
        ? {
            blob: screenshotResult.blob,
            byteLength: screenshotResult.byteLength,
            contentType: screenshotResult.contentType,
          }
        : null,
    },
    snapshot,
  };
}
