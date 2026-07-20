/** Re-export for E1-S4; snapshot export lives in capture-core. */
export {
  type BufferSnapshot,
  CAPTURE_CORE_VERSION,
  type CaptureCoreConfig,
  createRecorder,
  exportBufferSnapshot,
  type Recorder,
  resolveBufferSeconds,
} from "@usebugreport/capture-core";

/** SDK public API placeholder — init/submit in E1-S4. */
export const SDK_VERSION = "0.0.0-stub";
