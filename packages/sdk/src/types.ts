import type { CaptureSubmitPayload } from "@usebugreport/capture-core";

export class UseBugReportConfigError extends Error {
  readonly code = "UBR_CONFIG_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "UseBugReportConfigError";
  }
}

export class UseBugReportNotInitializedError extends Error {
  readonly code = "UBR_NOT_INITIALIZED";

  constructor(message: string) {
    super(message);
    this.name = "UseBugReportNotInitializedError";
  }
}

export interface WidgetInitOptions {
  /** Keyboard chord to open widget (default Shift+Alt+B). */
  hotkey?: string;
  /** Show floating action button (default true). */
  showFloatingButton?: boolean;
}

export interface UseBugReportInitOptions {
  /** API origin for capture ingest routes (default: current page origin). */
  apiBaseUrl?: string;
  blockClass?: string;
  bufferSeconds?: number;
  captureConsole?: boolean;
  captureNetwork?: boolean;
  captureScreenshot?: boolean;
  maskSelectors?: string[];
  /** PRD addendum: metadata hook → capture-core metadataProvider */
  metadata?: () => Record<string, unknown>;
  networkBodyMaxBytes?: number;
  /** Called after submit assembles payload (before any HTTP in E2) */
  onSubmit?: (result: SubmitResult) => void | Promise<void>;
  projectKey: string;
  screenshotMode?: "viewport" | "fullPage";
  /** Mount shadow-DOM submit widget (default true). */
  widget?: boolean | WidgetInitOptions;
}

export interface SubmitOptions {
  description?: string;
  title: string;
}

export interface SubmitResult {
  description?: string;
  payload: CaptureSubmitPayload;
  projectKey: string;
  /** Present after successful HTTP ingest (E1-S5 widget path). */
  reportId?: string;
  title: string;
}
