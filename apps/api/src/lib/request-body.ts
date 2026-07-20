export function readJsonBody<T extends Record<string, unknown>>(
  body: unknown
): T | null {
  if (body === null || body === undefined || typeof body !== "object") {
    return null;
  }

  if (Array.isArray(body)) {
    return null;
  }

  return body as T;
}
