import { UseBugReportConfigError } from "./types";

export const INGEST_KEY_PREFIX = "ubr_ingest_";
/** `ubr_ingest_` (11) + 32 base62 chars from generateIngestKeyPlaintext */
export const MIN_INGEST_KEY_LENGTH = 43;

export function validateProjectKey(key: unknown): asserts key is string {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new UseBugReportConfigError("projectKey is required");
  }

  const trimmed = key.trim();
  if (trimmed !== key) {
    throw new UseBugReportConfigError("projectKey is required");
  }

  if (!trimmed.startsWith(INGEST_KEY_PREFIX)) {
    throw new UseBugReportConfigError(
      "projectKey must be a project ingest key (ubr_ingest_...)"
    );
  }

  if (trimmed.length < MIN_INGEST_KEY_LENGTH) {
    throw new UseBugReportConfigError("projectKey appears truncated");
  }
}
