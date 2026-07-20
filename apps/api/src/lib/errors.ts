import type { ApiErrorCode, ApiErrorEnvelope } from "@usebugreport/contracts";

export type { ApiErrorCode, ApiErrorEnvelope } from "@usebugreport/contracts";

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

export function forbiddenError(
  message: string,
  requestId = createRequestId(),
  details?: Record<string, unknown>
): ApiErrorEnvelope {
  return {
    error: {
      code: "FORBIDDEN",
      details,
      message,
      requestId,
    },
  };
}

export function notFoundError(
  message: string,
  requestId = createRequestId()
): ApiErrorEnvelope {
  return {
    error: {
      code: "NOT_FOUND",
      message,
      requestId,
    },
  };
}

export function validationError(
  message: string,
  requestId = createRequestId(),
  details?: Record<string, unknown>
): ApiErrorEnvelope {
  return {
    error: {
      code: "VALIDATION_ERROR",
      details,
      message,
      requestId,
    },
  };
}

export function internalError(
  requestId = createRequestId(),
  message = "An unexpected error occurred."
): ApiErrorEnvelope {
  return {
    error: {
      code: "INTERNAL",
      message,
      requestId,
    },
  };
}

export function rateLimitedError(
  message: string,
  requestId = createRequestId(),
  details?: Record<string, unknown>
): ApiErrorEnvelope {
  return {
    error: {
      code: "RATE_LIMITED",
      details,
      message,
      requestId,
    },
  };
}

const SERVICE_ERROR_STATUS: Record<string, number> = {
  CONFLICT: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  QUOTA_EXCEEDED: 429,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 422,
};

const SERVICE_ERROR_CODES = new Set<string>([
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "VALIDATION_ERROR",
]);

export function serviceErrorToHttp(
  error: { code: string; message: string; details?: Record<string, unknown> },
  requestId: string
): { status: number; body: ApiErrorEnvelope } {
  const code = (
    SERVICE_ERROR_CODES.has(error.code) ? error.code : "VALIDATION_ERROR"
  ) as ApiErrorCode;

  return {
    body: {
      error: {
        code,
        details: error.details,
        message: error.message,
        requestId,
      },
    },
    status: SERVICE_ERROR_STATUS[error.code] ?? 422,
  };
}

export function quotaExceededError(
  message: string,
  requestId = createRequestId(),
  details?: Record<string, unknown>
): ApiErrorEnvelope {
  return {
    error: {
      code: "QUOTA_EXCEEDED",
      details,
      message,
      requestId,
    },
  };
}

export function quotaExceededToHttp(
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): { status: number; body: ApiErrorEnvelope } {
  return {
    body: quotaExceededError(message, requestId, details),
    status: 429,
  };
}
