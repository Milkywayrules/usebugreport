const PRESIGNED_SIGNATURE_PATTERN = /X-Amz-Signature=/i;
const PRESIGNED_CREDENTIAL_PATTERN = /X-Amz-Credential=/i;
const SIG_QUERY_PATTERN = /sig=/i;
const TOKEN_QUERY_PATTERN = /token=[^&\s]+/i;

const SECRET_KEY_PATTERN = /(authorization|ingestkey|api[_-]?key|secret)/i;

export const DEFAULT_REDACT_PATHS = [
  "authorization",
  "headers.authorization",
  "headers.cookie",
  "ingestKey",
  "ingestKeyPlaintext",
  "r2Key",
  "presignedUrl",
  "url",
] as const;

export const DEFAULT_REDACT_PATTERNS = [
  PRESIGNED_SIGNATURE_PATTERN,
  PRESIGNED_CREDENTIAL_PATTERN,
  SIG_QUERY_PATTERN,
  TOKEN_QUERY_PATTERN,
] as const;

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    if (
      PRESIGNED_SIGNATURE_PATTERN.test(value) ||
      PRESIGNED_CREDENTIAL_PATTERN.test(value) ||
      SIG_QUERY_PATTERN.test(value) ||
      TOKEN_QUERY_PATTERN.test(value)
    ) {
      return "[REDACTED]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key) || key === "r2Key" || key === "presignedUrl") {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = redactSecrets(nested);
    }
    return output;
  }

  return value;
}

export function redactWideEvent<T extends Record<string, unknown>>(event: T): T {
  return redactSecrets(event) as T;
}
