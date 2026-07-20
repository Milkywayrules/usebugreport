import {
  createProjectService,
  createWorkspaceService,
  ServiceError,
} from "@usebugreport/services";
import type { Elysia } from "elysia";
import { auth, db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { requireSession } from "../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

function sessionAuthContext(
  authResult: Extract<ReturnType<typeof requireSession>, { ok: true }>["value"],
  organizationId: string
) {
  return {
    organizationId,
    requestId: authResult.requestId,
    type: "session" as const,
    userId: authResult.user.id,
  };
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

function activeOrganizationId(
  session: SessionHandlerContext["session"]
): string {
  return (
    (session as { activeOrganizationId?: string | null } | null)
      ?.activeOrganizationId ?? ""
  );
}

export function registerProjectRoutes(app: unknown): unknown {
  const routeApp = app as Elysia;
  const workspaceService = createWorkspaceService(db, {
    authApi: {
      getSession: auth.api.getSession,
    },
    usageService: {} as never,
  });
  const projectService = createProjectService(db);

  return routeApp
    .get("/api/v1/projects/:projectId", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const organizationId = activeOrganizationId(authResult.value.session);
      if (!organizationId) {
        return jsonResponse(
          serviceErrorToHttp(
            {
              code: "FORBIDDEN",
              message: "Active workspace required.",
            },
            authResult.value.requestId
          ).body,
          403
        );
      }

      try {
        await workspaceService.requireOrgMember(
          sessionAuthContext(authResult.value, organizationId),
          organizationId
        );

        const project = await projectService.getProject(
          sessionAuthContext(authResult.value, organizationId),
          context.params.projectId
        );

        return { project, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .patch("/api/v1/projects/:projectId", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const organizationId = activeOrganizationId(authResult.value.session);
      if (!organizationId) {
        return jsonResponse(
          serviceErrorToHttp(
            {
              code: "FORBIDDEN",
              message: "Active workspace required.",
            },
            authResult.value.requestId
          ).body,
          403
        );
      }

      const body = readJsonBody<{ name?: string; slug?: string }>(context.body);
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

      try {
        await workspaceService.requireOrgAdmin(
          sessionAuthContext(authResult.value, organizationId),
          organizationId
        );

        const project = await projectService.updateProject(
          sessionAuthContext(authResult.value, organizationId),
          context.params.projectId,
          body
        );

        return { project, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .delete("/api/v1/projects/:projectId", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const organizationId = activeOrganizationId(authResult.value.session);
      if (!organizationId) {
        return jsonResponse(
          serviceErrorToHttp(
            {
              code: "FORBIDDEN",
              message: "Active workspace required.",
            },
            authResult.value.requestId
          ).body,
          403
        );
      }

      try {
        await workspaceService.requireOrgAdmin(
          sessionAuthContext(authResult.value, organizationId),
          organizationId
        );

        const project = await projectService.deleteProject(
          sessionAuthContext(authResult.value, organizationId),
          context.params.projectId
        );

        return { project, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/projects/:projectId/ingest-keys/rotate", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const organizationId = activeOrganizationId(authResult.value.session);
      if (!organizationId) {
        return jsonResponse(
          serviceErrorToHttp(
            {
              code: "FORBIDDEN",
              message: "Active workspace required.",
            },
            authResult.value.requestId
          ).body,
          403
        );
      }

      try {
        await workspaceService.requireOrgAdmin(
          sessionAuthContext(authResult.value, organizationId),
          organizationId
        );

        const result = await projectService.rotateIngestKey(
          sessionAuthContext(authResult.value, organizationId),
          context.params.projectId
        );

        return {
          ingestKeyPlaintext: result.ingestKeyPlaintext,
          keyPrefix: result.keyPrefix,
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    });
}
