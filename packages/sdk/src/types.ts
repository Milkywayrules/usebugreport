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

export interface UseBugReportInitOptions {
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
}

export interface SubmitOptions {
  description?: string;
  title: string;
}

export interface SubmitResult {
  description?: string;
  payload: CaptureSubmitPayload;
  projectKey: string;
  title: string;
}
