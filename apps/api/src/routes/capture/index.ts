import {
  type CaptureIngestService,
  type PresignPartInput,
  type PresignUploadInput,
  type ProjectService,
  ServiceError,
} from "@usebugreport/services";
import type { Elysia } from "elysia";
import { serviceErrorToHttp, validationError } from "../../lib/errors";
import { readJsonBody } from "../../lib/request-body";
import {
  requireIdempotencyKey,
  requireIngestKeyAuth,
} from "../../middleware/ingest-key-auth";

interface CaptureHandlerContext {
  body: unknown;
  request: Request;
  requestId: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function handleServiceError(error: unknown, requestId: string): Response {
  if (error instanceof ServiceError) {
    const mapped = serviceErrorToHttp(error, requestId);
    return jsonResponse(mapped.body, mapped.status);
  }
  throw error;
}

function parsePresignBody(body: unknown): PresignUploadInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.parts)) {
    return null;
  }

  const parts: PresignPartInput[] = [];
  for (const entry of record.parts) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const part = entry as Record<string, unknown>;
    if (typeof part.name !== "string" || typeof part.contentType !== "string") {
      return null;
    }
    parts.push({
      contentType: part.contentType,
      name: part.name as PresignPartInput["name"],
      seq: typeof part.seq === "number" ? part.seq : undefined,
    });
  }

  return {
    description:
      typeof record.description === "string" ? record.description : undefined,
    parts,
    title: typeof record.title === "string" ? record.title : undefined,
  };
}

function parseCompleteBody(
  body: unknown
): { reportId: string; r2Keys: string[] } | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.reportId !== "string") {
    return null;
  }
  if (!Array.isArray(record.r2Keys)) {
    return null;
  }
  if (!record.r2Keys.every((key) => typeof key === "string")) {
    return null;
  }

  return {
    r2Keys: record.r2Keys,
    reportId: record.reportId,
  };
}

export function registerCaptureRoutes(
  app: unknown,
  deps: {
    captureIngestService: CaptureIngestService;
    projectService: Pick<ProjectService, "validateIngestKey">;
  }
): unknown {
  const routeApp = app as Elysia;

  return routeApp
    .post("/api/v1/capture/presign", async (context) => {
      const handlerContext = context as unknown as CaptureHandlerContext;
      const authResult = await requireIngestKeyAuth(
        handlerContext,
        deps.projectService
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const idempotencyResult = requireIdempotencyKey(
        handlerContext.request,
        authResult.value.requestId
      );
      if (!idempotencyResult.ok) {
        return jsonResponse(idempotencyResult.body, idempotencyResult.status);
      }

      const body = parsePresignBody(readJsonBody(handlerContext.body));
      if (!body) {
        return jsonResponse(
          validationError("Invalid request body.", authResult.value.requestId),
          422
        );
      }

      try {
        const result = await deps.captureIngestService.presignUpload(
          {
            idempotencyKey: idempotencyResult.value,
            organizationId: authResult.value.organizationId,
            projectId: authResult.value.projectId,
            requestId: authResult.value.requestId,
          },
          body
        );

        return jsonResponse(
          {
            reportId: result.reportId,
            requestId: authResult.value.requestId,
            uploads: result.uploads,
          },
          200
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/capture/complete", async (context) => {
      const handlerContext = context as unknown as CaptureHandlerContext;
      const startedAt = performance.now();
      const authResult = await requireIngestKeyAuth(
        handlerContext,
        deps.projectService
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const idempotencyResult = requireIdempotencyKey(
        handlerContext.request,
        authResult.value.requestId
      );
      if (!idempotencyResult.ok) {
        return jsonResponse(idempotencyResult.body, idempotencyResult.status);
      }

      const body = parseCompleteBody(readJsonBody(handlerContext.body));
      if (!body) {
        return jsonResponse(
          validationError("Invalid request body.", authResult.value.requestId),
          422
        );
      }

      try {
        const result = await deps.captureIngestService.completeIngest(
          {
            idempotencyKey: idempotencyResult.value,
            organizationId: authResult.value.organizationId,
            projectId: authResult.value.projectId,
            requestId: authResult.value.requestId,
          },
          body
        );

        const durationMs = performance.now() - startedAt;
        return jsonResponse(
          {
            durationMs,
            reportId: result.reportId,
            requestId: authResult.value.requestId,
            status: result.status,
          },
          202
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    });
}
