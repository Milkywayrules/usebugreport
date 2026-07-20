export interface WorkerLogFields {
  err?: Error;
  message: string;
  organizationId?: string;
  reportId?: string;
  traceId?: string;
}

/** Structured JSON logs (Pino-compatible shape) without logging blob keys or URLs. */
export function logWorkerEvent(fields: WorkerLogFields): void {
  const payload: Record<string, unknown> = {
    level: fields.err ? "error" : "info",
    msg: fields.message,
    service: "worker",
  };
  if (fields.traceId) payload.traceId = fields.traceId;
  if (fields.organizationId) payload.organizationId = fields.organizationId;
  if (fields.reportId) payload.reportId = fields.reportId;
  if (fields.err) {
    payload.err = {
      message: fields.err.message,
      name: fields.err.name,
    };
  }
  console.log(JSON.stringify(payload));
}
