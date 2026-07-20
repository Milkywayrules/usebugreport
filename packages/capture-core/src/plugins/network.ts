import type { NetworkHeaders, NetworkRequest } from "@rrweb/types";
import type { ResolvedCaptureCoreConfig } from "../types";
import { getRecordNetworkPlugin } from "../vendor/rrweb-plugin-network-record";

export const REDACTED = "[REDACTED]";
export const TRUNCATED_MARKER = "[TRUNCATED]";

const DEFAULT_INGEST_PATH_PATTERN = /\/api\/v1\/capture\//;

export function defaultIgnoreRequestFn(url: string): boolean {
  return DEFAULT_INGEST_PATH_PATTERN.test(url);
}

export function shouldIgnoreRequest(
  url: string,
  config: Pick<ResolvedCaptureCoreConfig, "ignoreRequestFn">
): boolean {
  if (defaultIgnoreRequestFn(url)) {
    return true;
  }
  return config.ignoreRequestFn?.(url) ?? false;
}

export function redactHeaders(
  headers: NetworkHeaders | undefined
): NetworkHeaders | undefined {
  if (!headers) {
    return headers;
  }
  const next: NetworkHeaders = { ...headers };
  for (const key of Object.keys(next)) {
    const lower = key.toLowerCase();
    if (
      lower === "authorization" ||
      lower === "cookie" ||
      lower === "set-cookie"
    ) {
      next[key] = REDACTED;
    }
  }
  return next;
}

export function truncateBody(
  body: string | null | undefined,
  maxBytes: number
): string | null | undefined {
  if (body === null || typeof body !== "string") {
    return body;
  }
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  if (bytes.length <= maxBytes) {
    return body;
  }
  const truncated = bytes.slice(0, maxBytes);
  return `${new TextDecoder().decode(truncated)}${TRUNCATED_MARKER}`;
}

export function sanitizeNetworkRequest(
  request: NetworkRequest,
  maxBodyBytes: number
): NetworkRequest | undefined {
  return {
    ...request,
    requestBody: truncateBody(request.requestBody, maxBodyBytes),
    requestHeaders: redactHeaders(request.requestHeaders),
    responseBody: truncateBody(request.responseBody, maxBodyBytes),
    responseHeaders: redactHeaders(request.responseHeaders),
  };
}

/**
 * Wires the official rrweb network record plugin (vendored — npm package unpublished at 2.1.0)
 * with privacy redaction, body caps, and ingest URL exclusion (FR-2, AC-7, AC-8).
 */
export function createNetworkPlugin(config: ResolvedCaptureCoreConfig) {
  return getRecordNetworkPlugin({
    initiatorTypes: ["fetch", "xmlhttprequest"],
    recordBody: true,
    recordHeaders: true,
    recordInitialRequests: false,
    transformRequestFn: (request) => {
      if (shouldIgnoreRequest(request.name, config)) {
        return;
      }
      return sanitizeNetworkRequest(request, config.networkBodyMaxBytes);
    },
  });
}
