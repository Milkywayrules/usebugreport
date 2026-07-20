import type { ProjectService } from "@usebugreport/services";
import {
  type ApiErrorEnvelope,
  unauthorizedError,
  validationError,
} from "../lib/errors";

export interface IngestKeyContext {
  organizationId: string;
  projectId: string;
  requestId: string;
}

export async function requireIngestKeyAuth(
  context: {
    request: Request;
    requestId: string;
  },
  projectService: Pick<ProjectService, "validateIngestKey">
): Promise<
  | { ok: true; value: IngestKeyContext }
  | { ok: false; status: 401; body: ApiErrorEnvelope }
> {
  const ingestKey = context.request.headers.get("X-Ingest-Key")?.trim();
  if (!ingestKey) {
    return {
      body: unauthorizedError(
        "Invalid or missing ingest key.",
        context.requestId
      ),
      ok: false,
      status: 401,
    };
  }

  const validated = await projectService.validateIngestKey(ingestKey);
  if (!validated) {
    return {
      body: unauthorizedError(
        "Invalid or missing ingest key.",
        context.requestId
      ),
      ok: false,
      status: 401,
    };
  }

  return {
    ok: true,
    value: {
      organizationId: validated.organizationId,
      projectId: validated.projectId,
      requestId: context.requestId,
    },
  };
}

export function requireIdempotencyKey(
  request: Request,
  requestId: string
):
  | { ok: true; value: string }
  | { ok: false; status: 422; body: ApiErrorEnvelope } {
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) {
    return {
      body: validationError("Idempotency-Key header is required.", requestId),
      ok: false,
      status: 422,
    };
  }

  return { ok: true, value: idempotencyKey };
}
