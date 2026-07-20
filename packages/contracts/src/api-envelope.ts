export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL";

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}
