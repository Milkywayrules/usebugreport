export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "VALIDATION_ERROR";

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export function createRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function unauthorizedError(
  message = "Authentication required.",
  requestId = createRequestId()
): ApiErrorEnvelope {
  return {
    error: {
      code: "UNAUTHORIZED",
      message,
      requestId,
    },
  };
}
