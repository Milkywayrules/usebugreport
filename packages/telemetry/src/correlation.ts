export function correlateTraceId(
  requestId: string,
  traceId?: string | null
): { requestId: string; traceId?: string } {
  if (traceId?.trim()) {
    return { requestId, traceId };
  }
  return { requestId };
}
