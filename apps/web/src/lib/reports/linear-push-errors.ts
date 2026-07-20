export function isLinearTokenExpiredMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("linear token refresh failed") ||
    normalized.includes("linear oauth") ||
    normalized.includes("token refresh failed")
  );
}

export function isLinearPushRetryRequired(message: string): boolean {
  return message.includes("Explicit retry");
}
