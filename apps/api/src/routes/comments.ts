import { type CommentService, ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { INTEGRATION_PUBLIC_TAG } from "../lib/route-tags";
import {
  type ReportAccessRequestContext,
  resolveReportWriteAccess,
} from "../middleware/report-access";

export interface CommentRouteDeps {
  commentService: CommentService;
  onCommentCreated?: (input: {
    commentId: string;
    organizationId: string;
    reportId: string;
  }) => Promise<void>;
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

function toAccessContext(context: unknown): ReportAccessRequestContext {
  const ctx = context as ReportAccessRequestContext & { requestId: string };
  return {
    apiKeyAuth: ctx.apiKeyAuth ?? null,
    request: ctx.request,
    requestId: ctx.requestId,
    session: ctx.session ?? null,
    user: ctx.user ?? null,
  };
}

export function registerCommentRoutes(
  app: unknown,
  deps: CommentRouteDeps
): unknown {
  const routeApp = app as Elysia;
  const { commentService, onCommentCreated } = deps;

  return routeApp.post(
    "/api/v1/reports/:reportId/comments",
    async (context) => {
      const access = await resolveReportWriteAccess(
        db,
        toAccessContext(context)
      );
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }

      if (access.ctx.type === "session") {
        return jsonResponse(
          {
            error: {
              code: "FORBIDDEN",
              message: "Use the web comments route for session auth.",
              requestId: access.requestId,
            },
          },
          403
        );
      }

      const body = await readJsonBody<{ body?: unknown }>(context.request);
      if (!body || typeof body.body !== "string") {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "body is required.",
              requestId: access.requestId,
            },
          },
          422
        );
      }

      const dedupeHeader = context.request.headers.get("Idempotency-Key");

      try {
        const comment = await commentService.create(
          access.ctx,
          context.params.reportId,
          {
            body: body.body,
            dedupeKey: dedupeHeader,
          }
        );
        if (comment.isNew && onCommentCreated) {
          await onCommentCreated({
            commentId: comment.id,
            organizationId: access.ctx.organizationId,
            reportId: context.params.reportId,
          });
        }

        const { isNew: _isNew, createdAt, ...commentRest } = comment;
        return {
          data: {
            ...commentRest,
            createdAt: createdAt.toISOString(),
          },
          requestId: access.requestId,
        };
      } catch (error) {
        return handleServiceError(error, access.requestId);
      }
    },
    {
      detail: { tags: [INTEGRATION_PUBLIC_TAG] },
    }
  );
}
