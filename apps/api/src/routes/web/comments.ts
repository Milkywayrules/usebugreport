import { type CommentService, ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../../lib/auth";
import { serviceErrorToHttp } from "../../lib/errors";
import { readJsonBody } from "../../lib/request-body";
import { ROUTE_TAGS } from "../../lib/route-tags";
import { resolveAuthContext } from "../../middleware/auth-context";
import { requireSession } from "../../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

export interface WebCommentRouteDeps {
  commentService: CommentService;
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

export function registerWebCommentRoutes(
  app: unknown,
  deps: WebCommentRouteDeps
): unknown {
  const routeApp = app as Elysia;
  const { commentService } = deps;

  return routeApp
    .get("/api/web/reports/:reportId/comments", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const resolved = await resolveAuthContext(db, authResult.value);
      if ("error" in resolved) {
        return jsonResponse(
          {
            error: {
              code: "FORBIDDEN",
              message: "Active workspace required.",
              requestId: authResult.value.requestId,
            },
          },
          403
        );
      }

      try {
        const thread = await commentService.list(
          resolved,
          context.params.reportId
        );
        return {
          data: thread.comments.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
          meta: { canComment: thread.canComment },
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    }, {
      detail: { hide: true, tags: [ROUTE_TAGS.sessionBff] },
    })
    .post("/api/web/reports/:reportId/comments", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const resolved = await resolveAuthContext(db, authResult.value);
      if ("error" in resolved) {
        return jsonResponse(
          {
            error: {
              code: "FORBIDDEN",
              message: "Active workspace required.",
              requestId: authResult.value.requestId,
            },
          },
          403
        );
      }

      const body = readJsonBody<{ body?: unknown }>(context.body);
      if (!body || typeof body.body !== "string") {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "body is required.",
              requestId: authResult.value.requestId,
            },
          },
          422
        );
      }

      try {
        const comment = await commentService.create(resolved, context.params.reportId, {
          body: body.body,
        });
        return {
          data: {
            ...comment,
            createdAt: comment.createdAt.toISOString(),
          },
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    }, {
      detail: { hide: true, tags: [ROUTE_TAGS.sessionBff] },
    });
}
