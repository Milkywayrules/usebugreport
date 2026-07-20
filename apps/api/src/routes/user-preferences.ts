import { createWorkspaceService, ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { auth, db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { requireSession } from "../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export function registerUserPreferenceRoutes(app: unknown): unknown {
  const routeApp = app as Elysia;
  const workspaceService = createWorkspaceService(db, {
    authApi: {
      getSession: auth.api.getSession,
    },
    usageService: {} as never,
  });

  return routeApp
    .get("/api/v1/user/preferences", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const preferences = await workspaceService.getPinnedPreferences({
        organizationId: "",
        requestId: authResult.value.requestId,
        type: "session",
        userId: authResult.value.user.id,
      });

      return { ...preferences, requestId: authResult.value.requestId };
    })
    .patch("/api/v1/user/preferences", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const body = readJsonBody<{
        pinnedOrder?: Record<string, number>;
        pinnedWorkspaceIds?: string[];
      }>(context.body);
      if (!body) {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request body.",
              requestId: authResult.value.requestId,
            },
          },
          422
        );
      }

      if (!Array.isArray(body.pinnedWorkspaceIds)) {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "pinnedWorkspaceIds must be an array.",
              requestId: authResult.value.requestId,
            },
          },
          422
        );
      }

      try {
        const preferences = await workspaceService.updatePinnedPreferences(
          {
            organizationId: "",
            requestId: authResult.value.requestId,
            type: "session",
            userId: authResult.value.user.id,
          },
          {
            pinnedOrder: body.pinnedOrder,
            pinnedWorkspaceIds: body.pinnedWorkspaceIds,
          }
        );

        return { ...preferences, requestId: authResult.value.requestId };
      } catch (error) {
        if (error instanceof ServiceError) {
          const mapped = serviceErrorToHttp(error, authResult.value.requestId);
          return jsonResponse(mapped.body, mapped.status);
        }
        throw error;
      }
    });
}
