export { CircularReplayBuffer } from "./buffer/circular-buffer";
export {
  clearMetadataProvider,
  collectEnvironmentMetadata,
  registerMetadataProvider,
} from "./metadata";
export {
  defaultIgnoreRequestFn,
  REDACTED,
  redactHeaders,
  sanitizeNetworkRequest,
  shouldIgnoreRequest,
  TRUNCATED_MARKER,
  truncateBody,
} from "./plugins/network";
export { buildPrivacyOptions } from "./privacy/mask";
export {
  checkoutEveryNms,
  createRecorder,
  exportBufferSnapshot,
  resolveBufferSeconds,
} from "./record";
export {
  buildScreenshotPrivacyHooks,
  captureScreenshot,
  DEFAULT_WEBP_QUALITY,
  maskInputElements,
  maskSelectorElements,
  prepareScreenshotClone,
} from "./screenshot";
export {
  assembleSubmitPayload,
  GZIP_FALLBACK_MESSAGE,
  gzipJson,
} from "./submit-payload";
export {
  type AssembleSubmitPayloadOptions,
  type BufferSnapshot,
  type CaptureCoreConfig,
  type CaptureSubmitPayload,
  type ConsoleSnapshotEvent,
  DEFAULT_BUFFER_SECONDS,
  DEFAULT_NETWORK_BODY_MAX_BYTES,
  type EnvironmentMetadata,
  type ExportBufferSnapshotOptions,
  type GzipBlobPart,
  MAX_BUFFER_SECONDS,
  MAX_REPLAY_EVENT_COUNT,
  MIN_BUFFER_SECONDS,
  type NetworkSnapshotEvent,
  type Recorder,
  type ResolvedCaptureCoreConfig,
  type ScreenshotCaptureResult,
} from "./types";

export const CAPTURE_CORE_VERSION = "0.2.0";
