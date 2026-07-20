import type { LogData } from "@rrweb/rrweb-plugin-console-record";
import type { eventWithTime, NetworkData } from "@rrweb/types";

/** Default circular buffer window (FR-1). */
export const DEFAULT_BUFFER_SECONDS = 120;

/** Minimum configurable buffer window (FR-1). */
export const MIN_BUFFER_SECONDS = 30;

/** Maximum configurable buffer window (FR-1). */
export const MAX_BUFFER_SECONDS = 120;

/** Default network body cap per architecture §4 (32 KB). */
export const DEFAULT_NETWORK_BODY_MAX_BYTES = 32_768;

/**
 * Secondary memory bound: max DOM replay events retained across all checkout segments.
 * Primary bound is wall-time eviction via `bufferSeconds`; this guard prevents pathological
 * mutation storms from exhausting memory within the time window.
 */
export const MAX_REPLAY_EVENT_COUNT = 100_000;

export interface CaptureCoreConfig {
  blockClass?: string;
  bufferSeconds?: number;
  captureConsole?: boolean;
  captureNetwork?: boolean;
  /** When false, submit payload omits screenshot part (default true). */
  captureScreenshot?: boolean;
  ignoreRequestFn?: (url: string) => boolean;
  maskSelectors?: string[];
  metadataProvider?: () => Record<string, unknown>;
  networkBodyMaxBytes?: number;
  screenshotMode?: "viewport" | "fullPage";
  /** When true, out-of-range bufferSeconds throws instead of clamping. */
  strictBufferSeconds?: boolean;
}

export type ResolvedCaptureCoreConfig = Required<
  Pick<
    CaptureCoreConfig,
    | "bufferSeconds"
    | "captureConsole"
    | "captureNetwork"
    | "captureScreenshot"
    | "networkBodyMaxBytes"
    | "blockClass"
    | "screenshotMode"
  >
> &
  Pick<
    CaptureCoreConfig,
    "ignoreRequestFn" | "maskSelectors" | "metadataProvider"
  >;

export type ConsoleSnapshotEvent = LogData & { timestamp: number };

export type NetworkSnapshotEvent = NetworkData & { timestamp: number };

export interface BufferSnapshot {
  bufferSeconds: number;
  console: {
    events: ConsoleSnapshotEvent[];
  };
  exportedAt: string;
  network: {
    events: NetworkSnapshotEvent[];
  };
  replay: {
    /** rrweb events ready for gzip batch upload (E1-S3/E2-S2). */
    events: eventWithTime[];
    eventCount: number;
  };
}

export interface ExportBufferSnapshotOptions {
  seconds?: number;
}

export interface Recorder {
  dispose: () => void;
  exportSnapshot: (options?: ExportBufferSnapshotOptions) => BufferSnapshot;
  getBufferSeconds: () => number;
  getResolvedConfig: () => ResolvedCaptureCoreConfig;
  stop: () => void;
}

export interface EnvironmentMetadata {
  browser: { name: string; version: string };
  connection?: {
    downlink?: number;
    effectiveType?: string;
    rtt?: number;
  };
  custom?: Record<string, unknown>;
  devicePixelRatio: number;
  locale: string;
  os: { name: string; version?: string };
  referrer: string;
  timestamp: string;
  timezone: string;
  url: string;
  userAgent: string;
  viewport: { height: number; width: number };
}

export interface ScreenshotCaptureResult {
  blob: Blob;
  byteLength: number;
  contentType: "image/webp";
  height: number;
  width: number;
}

export interface GzipBlobPart {
  blob: Blob;
  byteLength: number;
  contentType: "application/gzip";
  /** Logical part name for E2 upload mapping (e.g. replay/batch-0.json.gz). */
  name: string;
  seq?: number;
}

export interface CaptureSubmitPayload {
  /** ISO-8601 assembly time (may match snapshot.exportedAt). */
  assembledAt: string;
  bufferSeconds: number;
  parts: {
    console: GzipBlobPart;
    meta: {
      blob: Blob;
      contentType: "application/json";
      json: EnvironmentMetadata;
    };
    network: GzipBlobPart;
    replay: GzipBlobPart[];
    screenshot: {
      blob: Blob;
      byteLength: number;
      contentType: "image/webp";
    } | null;
  };
  /** Raw snapshot retained for tests/debug; E2 may ignore. */
  snapshot: BufferSnapshot;
}

export interface AssembleSubmitPayloadOptions
  extends ExportBufferSnapshotOptions {
  /** Override recorder config for this assembly only. */
  config?: Partial<CaptureCoreConfig>;
}
