import type { DeletionService } from "@usebugreport/services";
import { ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { resolveAuthContext } from "../middleware/auth-context";
import { requireSession } from "../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

export interface DeletionRouteDeps {
  deletionService: DeletionService;
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

export function registerDeletionRoutes(app: unknown, deps: DeletionRouteDeps): unknown {
  const routeApp = app as Elysia;
  const { deletionService } = deps;

  return routeApp
    .post("/api/v1/workspaces/:organizationId/deletion", async (context) => {
      const authResult = requireSession(context as unknown as SessionHandlerContext);
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params as { organizationId: string };
      const resolved = await resolveAuthContext(db, authResult.value, organizationId);
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
        const data = await deletionService.enqueueWorkspaceDeletion(resolved);
        return jsonResponse(
          { data, requestId: authResult.value.requestId },
          202
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .get("/api/v1/workspaces/:organizationId/deletion-status", async (context) => {
      const authResult = requireSession(context as unknown as SessionHandlerContext);
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params as { organizationId: string };
      const resolved = await resolveAuthContext(db, authResult.value, organizationId);
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
        const data = await deletionService.getDeletionStatus(resolved, organizationId);
        return { data, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    });
}
