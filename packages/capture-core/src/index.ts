export { CircularReplayBuffer } from "./buffer/circular-buffer";
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
  type BufferSnapshot,
  type CaptureCoreConfig,
  type ConsoleSnapshotEvent,
  DEFAULT_BUFFER_SECONDS,
  DEFAULT_NETWORK_BODY_MAX_BYTES,
  type ExportBufferSnapshotOptions,
  MAX_BUFFER_SECONDS,
  MAX_REPLAY_EVENT_COUNT,
  MIN_BUFFER_SECONDS,
  type NetworkSnapshotEvent,
  type Recorder,
  type ResolvedCaptureCoreConfig,
} from "./types";

export const CAPTURE_CORE_VERSION = "0.1.0";
