import type { IntegrationService } from "@usebugreport/services";
import { ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../../lib/auth";
import { getEnv } from "../../lib/env";
import { serviceErrorToHttp } from "../../lib/errors";
import { readJsonBody } from "../../lib/request-body";
import { INTEGRATION_PUBLIC_TAG } from "../../lib/route-tags";
import { resolveAuthContext } from "../../middleware/auth-context";
import { requireSession } from "../../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

export interface LinearIntegrationRouteDeps {
  integrationService: IntegrationService;
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

export function registerLinearIntegrationRoutes(
  app: unknown,
  deps: LinearIntegrationRouteDeps
): unknown {
  const routeApp = app as Elysia;
  const { integrationService } = deps;
  const env = getEnv();

  return routeApp
    .get("/api/v1/integrations/linear/authorize", async (context) => {
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
        const payload = integrationService.getLinearAuthorizeUrl(resolved);
        return {
          data: payload,
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .get("/api/v1/integrations/linear/callback", async (context) => {
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

      const url = new URL(context.request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Missing OAuth code or state.",
              requestId: authResult.value.requestId,
            },
          },
          422
        );
      }

      try {
        await integrationService.connectLinear(resolved, { code, state });
        const slug = url.searchParams.get("workspace") ?? "";
        const redirect = slug
          ? `${env.APP_URL}/w/${slug}/settings/integrations/linear?connected=1`
          : `${env.APP_URL}/settings/integrations/linear?connected=1`;
        return Response.redirect(redirect, 302);
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .get("/api/v1/integrations/linear/status", async (context) => {
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
        const status = await integrationService.getLinearStatus(resolved);
        return {
          data: status,
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/integrations/linear/disconnect", async (context) => {
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
        await integrationService.disconnectLinear(resolved);
        return {
          data: { disconnected: true },
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .get("/api/v1/integrations/linear/teams", async (context) => {
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
        const teams = await integrationService.listLinearTeams(resolved);
        return {
          data: teams,
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/reports/:reportId/linear/push", async (context) => {
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
        const data = await integrationService.pushReportToLinear(
          resolved,
          context.params.reportId
        );
        return {
          data,
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    }, {
      detail: { tags: [INTEGRATION_PUBLIC_TAG] },
    })
    .patch("/api/v1/projects/:projectId/linear-default-team", async (context) => {
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

      const body = await readJsonBody<{ teamId?: string | null }>(
        context.request
      );

      try {
        await integrationService.updateProjectDefaultLinearTeam(
          resolved,
          context.params.projectId,
          body?.teamId ?? null
        );
        return {
          data: { projectId: context.params.projectId, teamId: body?.teamId ?? null },
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    }, {
      detail: { tags: [INTEGRATION_PUBLIC_TAG] },
    });
}
