import {
  type CaptureCoreConfig,
  createRecorder,
} from "@usebugreport/capture-core";
import { isInitialized, setInitialized } from "./state";
import type { UseBugReportInitOptions } from "./types";
import { UseBugReportConfigError } from "./types";
import { validateProjectKey } from "./validate";

function assertBrowserEnvironment(): void {
  if (typeof window === "undefined") {
    throw new Error(
      "init requires a browser environment (window is undefined)"
    );
  }
}

function mapInitOptions(options: UseBugReportInitOptions): CaptureCoreConfig {
  return {
    blockClass: options.blockClass,
    bufferSeconds: options.bufferSeconds,
    captureConsole: options.captureConsole,
    captureNetwork: options.captureNetwork,
    captureScreenshot: options.captureScreenshot,
    maskSelectors: options.maskSelectors,
    metadataProvider: options.metadata,
    networkBodyMaxBytes: options.networkBodyMaxBytes,
    screenshotMode: options.screenshotMode,
  };
}

export function init(options: UseBugReportInitOptions): void {
  assertBrowserEnvironment();

  if (isInitialized()) {
    throw new UseBugReportConfigError(
      "SDK already initialized; call dispose() before init()"
    );
  }

  validateProjectKey(options.projectKey);

  const recorder = createRecorder(mapInitOptions(options));

  setInitialized({
    onSubmit: options.onSubmit ?? null,
    projectKey: options.projectKey,
    recorder,
  });
}
