import {
  type CaptureCoreConfig,
  createRecorder,
} from "@usebugreport/capture-core";
import { isInitialized, setInitialized } from "./state";
import type { UseBugReportInitOptions, WidgetInitOptions } from "./types";
import { UseBugReportConfigError } from "./types";
import { validateProjectKey } from "./validate";
import { mountSubmitWidget } from "./widget";

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

  const apiBaseUrl = options.apiBaseUrl?.trim() || window.location.origin;
  const widgetEnabled = options.widget !== false;

  let widgetHost: import("./widget").WidgetHost | null = null;
  if (widgetEnabled) {
    const widgetOptions: WidgetInitOptions =
      typeof options.widget === "object" ? options.widget : {};
    widgetHost = mountSubmitWidget({
      apiBaseUrl,
      hotkey: widgetOptions.hotkey,
      onComplete: options.onSubmit ?? undefined,
      showFloatingButton: widgetOptions.showFloatingButton,
    });
  }

  setInitialized({
    apiBaseUrl,
    onSubmit: options.onSubmit ?? null,
    projectKey: options.projectKey,
    recorder,
    widgetHost,
  });
}
