import {
  createProjectService,
  createUsageService,
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

export function registerWorkspaceRoutes(app: unknown): unknown {
  const routeApp = app as Elysia;
  const usageService = createUsageService(db);
  const workspaceService = createWorkspaceService(db, {
    authApi: {
      getSession: auth.api.getSession,
    },
    usageService,
  });

  return routeApp
    .get("/api/v1/workspaces", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const ctx = sessionAuthContext(authResult.value, "");
      const workspaces = await workspaceService.listWorkspacesForUser(ctx);
      return { data: workspaces, requestId: authResult.value.requestId };
    })
    .post("/api/v1/workspaces", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
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
        const ctx = sessionAuthContext(authResult.value, "");
        const organization = await workspaceService.createWorkspace(
          ctx,
          { name: body.name ?? "", slug: body.slug },
          context.request.headers
        );
        return jsonResponse(
          { organization, requestId: authResult.value.requestId },
          201
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .patch("/api/v1/workspaces/:organizationId", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params;
      const body = readJsonBody<{ name?: string }>(context.body);
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
        const ctx = sessionAuthContext(authResult.value, organizationId);
        const organization = await workspaceService.updateWorkspace(
          ctx,
          organizationId,
          { name: body.name }
        );
        return { organization, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .get("/api/v1/workspaces/:organizationId/projects", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params;

      try {
        await workspaceService.requireOrgMember(
          sessionAuthContext(authResult.value, organizationId),
          organizationId
        );

        const projectService = createProjectService(db);
        const url = new URL(context.request.url);
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "50");

        const result = await projectService.listProjects(
          sessionAuthContext(authResult.value, organizationId),
          { cursor, limit }
        );

        return { ...result, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/workspaces/:organizationId/projects", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params;
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

        const projectService = createProjectService(db);
        const result = await projectService.createProject(
          sessionAuthContext(authResult.value, organizationId),
          { name: body.name ?? "", slug: body.slug }
        );

        return jsonResponse(
          {
            ingestKeyPlaintext: result.ingestKeyPlaintext,
            project: result.project,
            requestId: authResult.value.requestId,
          },
          201
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    });
}
