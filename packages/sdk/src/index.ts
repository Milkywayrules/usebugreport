/** Re-export for E1-S4; snapshot export lives in capture-core. */
export {
  type AssembleSubmitPayloadOptions,
  assembleSubmitPayload,
  type BufferSnapshot,
  CAPTURE_CORE_VERSION,
  type CaptureCoreConfig,
  type CaptureSubmitPayload,
  collectEnvironmentMetadata,
  createRecorder,
  type EnvironmentMetadata,
  exportBufferSnapshot,
  type Recorder,
  registerMetadataProvider,
  resolveBufferSeconds,
} from "@usebugreport/capture-core";

/** SDK public API placeholder — init/submit in E1-S4. */
export const SDK_VERSION = "0.0.0-stub";
