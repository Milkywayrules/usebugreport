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

export function serviceErrorToHttp(
  error: { code: string; message: string; details?: Record<string, unknown> },
  requestId: string
): { status: number; body: ApiErrorEnvelope } {
  const statusMap: Record<string, number> = {
    CONFLICT: 409,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    QUOTA_EXCEEDED: 403,
    VALIDATION_ERROR: 422,
  };
  const code = error.code as ApiErrorCode;
  return {
    body: {
      error: {
        code: (statusMap[error.code]
          ? code
          : "VALIDATION_ERROR") as ApiErrorCode,
        details: error.details,
        message: error.message,
        requestId,
      },
    },
    status: statusMap[error.code] ?? 422,
  };
}
