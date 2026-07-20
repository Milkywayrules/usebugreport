import { member, user } from "@usebugreport/db";
import {
  createProjectService,
  createUsageService,
  createWorkspaceService,
  ServiceError,
} from "@usebugreport/services";
import { eq } from "drizzle-orm";
import type { Elysia } from "elysia";
import { auth, db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { resolveAuthContext } from "../middleware/auth-context";
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

function resolveRouteContext(
  authResult: Extract<ReturnType<typeof requireSession>, { ok: true }>["value"],
  organizationId: string
) {
  return resolveAuthContext(db, authResult, organizationId);
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

        const ctx = await resolveRouteContext(authResult.value, organizationId);
        if ("error" in ctx) {
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

        const projectService = createProjectService(db);
        const url = new URL(context.request.url);
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "50");

        const result = await projectService.listProjects(ctx, {
          cursor,
          limit,
        });

        return { ...result, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .get("/api/v1/workspaces/:organizationId/members", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params;

      try {
        await workspaceService.requireOrgAdmin(
          sessionAuthContext(authResult.value, organizationId),
          organizationId
        );

        const rows = await db
          .select({
            email: user.email,
            name: user.name,
            role: member.role,
            userId: member.userId,
          })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(eq(member.organizationId, organizationId))
          .orderBy(user.name);

        return { data: rows, requestId: authResult.value.requestId };
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

        const ctx = await resolveRouteContext(authResult.value, organizationId);
        if ("error" in ctx) {
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

        const projectService = createProjectService(db);
        const result = await projectService.createProject(ctx, {
          name: body.name ?? "",
          slug: body.slug,
        });

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
