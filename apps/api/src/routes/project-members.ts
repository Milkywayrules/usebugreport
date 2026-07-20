import type { ProjectRole } from "@usebugreport/services";
import { createProjectService, ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import {
  activeOrganizationId,
  resolveAuthContext,
} from "../middleware/auth-context";
import { requireSession } from "../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

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

const PROJECT_ROLES: ProjectRole[] = [
  "viewer",
  "reporter",
  "developer",
  "admin",
];

function isProjectRole(value: unknown): value is ProjectRole {
  return (
    typeof value === "string" && PROJECT_ROLES.includes(value as ProjectRole)
  );
}

export function registerProjectMemberRoutes(app: unknown): unknown {
  const routeApp = app as Elysia;
  const projectService = createProjectService(db);

  return routeApp
    .get("/api/v1/projects/:projectId/members", async (context) => {
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
        const ctx = await resolveAuthContext(
          db,
          authResult.value,
          organizationId
        );
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

        const members = await projectService.listProjectMembers(
          ctx,
          context.params.projectId
        );

        return { data: members, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/projects/:projectId/members", async (context) => {
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

      const body = readJsonBody<{ role?: string; userId?: string }>(
        context.body
      );
      if (!(body?.userId && isProjectRole(body.role))) {
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
        const ctx = await resolveAuthContext(
          db,
          authResult.value,
          organizationId
        );
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

        const memberRow = await projectService.addProjectMember(
          ctx,
          context.params.projectId,
          { role: body.role, userId: body.userId }
        );

        return jsonResponse(
          { member: memberRow, requestId: authResult.value.requestId },
          201
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .patch("/api/v1/projects/:projectId/members/:userId", async (context) => {
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

      const body = readJsonBody<{ role?: string }>(context.body);
      if (!isProjectRole(body?.role)) {
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
        const ctx = await resolveAuthContext(
          db,
          authResult.value,
          organizationId
        );
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

        const memberRow = await projectService.updateProjectMemberRole(
          ctx,
          context.params.projectId,
          context.params.userId,
          body.role
        );

        return { member: memberRow, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .delete("/api/v1/projects/:projectId/members/:userId", async (context) => {
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
        const ctx = await resolveAuthContext(
          db,
          authResult.value,
          organizationId
        );
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

        await projectService.removeProjectMember(
          ctx,
          context.params.projectId,
          context.params.userId
        );

        return new Response(null, { status: 204 });
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    });
}
