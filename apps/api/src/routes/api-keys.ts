import { createApiKeyService, ServiceError } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { resolveAuthContext } from "../middleware/auth-context";
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

export function registerApiKeyRoutes(app: unknown): unknown {
  const routeApp = app as Elysia;
  const apiKeyService = createApiKeyService(db);

  return routeApp
    .get("/api/v1/workspaces/:organizationId/api-keys", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params;

      try {
        const ctx = await resolveAuthContext(
          db,
          authResult.value,
          organizationId
        );
        if ("error" in ctx) {
          return jsonResponse(
            serviceErrorToHttp(
              { code: "FORBIDDEN", message: "Active workspace required." },
              authResult.value.requestId
            ).body,
            403
          );
        }

        const keys = await apiKeyService.listApiKeys(ctx);
        return { data: keys, requestId: authResult.value.requestId };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post("/api/v1/workspaces/:organizationId/api-keys", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const { organizationId } = context.params;
      const body = readJsonBody<{
        expiresAt?: string | null;
        name?: string;
        scopes?: string[];
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

      try {
        const ctx = await resolveAuthContext(
          db,
          authResult.value,
          organizationId
        );
        if ("error" in ctx) {
          return jsonResponse(
            serviceErrorToHttp(
              { code: "FORBIDDEN", message: "Active workspace required." },
              authResult.value.requestId
            ).body,
            403
          );
        }

        const result = await apiKeyService.createApiKey(ctx, {
          expiresAt: body.expiresAt,
          name: body.name ?? "",
          scopes: body.scopes ?? [],
        });

        return jsonResponse(
          {
            apiKey: result.apiKey,
            keyPlaintext: result.keyPlaintext,
            requestId: authResult.value.requestId,
          },
          201
        );
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })
    .post(
      "/api/v1/workspaces/:organizationId/api-keys/:keyId/rotate",
      async (context) => {
        const authResult = requireSession(
          context as unknown as SessionHandlerContext
        );
        if (!authResult.ok) {
          return jsonResponse(authResult.body, authResult.status);
        }

        const { keyId, organizationId } = context.params;

        try {
          const ctx = await resolveAuthContext(
            db,
            authResult.value,
            organizationId
          );
          if ("error" in ctx) {
            return jsonResponse(
              serviceErrorToHttp(
                { code: "FORBIDDEN", message: "Active workspace required." },
                authResult.value.requestId
              ).body,
              403
            );
          }

          const result = await apiKeyService.rotateApiKey(ctx, keyId);
          return {
            apiKey: result.apiKey,
            keyPlaintext: result.keyPlaintext,
            requestId: authResult.value.requestId,
          };
        } catch (error) {
          return handleServiceError(error, authResult.value.requestId);
        }
      }
    )
    .delete(
      "/api/v1/workspaces/:organizationId/api-keys/:keyId",
      async (context) => {
        const authResult = requireSession(
          context as unknown as SessionHandlerContext
        );
        if (!authResult.ok) {
          return jsonResponse(authResult.body, authResult.status);
        }

        const { keyId, organizationId } = context.params;

        try {
          const ctx = await resolveAuthContext(
            db,
            authResult.value,
            organizationId
          );
          if ("error" in ctx) {
            return jsonResponse(
              serviceErrorToHttp(
                { code: "FORBIDDEN", message: "Active workspace required." },
                authResult.value.requestId
              ).body,
              403
            );
          }

          await apiKeyService.revokeApiKey(ctx, keyId);
          return new Response(null, { status: 204 });
        } catch (error) {
          return handleServiceError(error, authResult.value.requestId);
        }
      }
    )
    .get("/api/v1/auth/context-probe", async (context) => {
      if (process.env.NODE_ENV === "production") {
        return new Response(null, { status: 404 });
      }

      const handlerContext = context as unknown as SessionHandlerContext & {
        apiKeyAuth: import("@usebugreport/services").AuthContext | null;
      };

      const url = new URL(context.request.url);
      const organizationIdParam = url.searchParams.get("organizationId");

      const bearer = context.request.headers.get("authorization");
      if (bearer?.startsWith("Bearer ubr_live_")) {
        const { requireApiKeyAuth } = await import(
          "../middleware/api-key-auth"
        );
        const apiKeyResult = requireApiKeyAuth({
          apiKeyAuth: handlerContext.apiKeyAuth,
          request: context.request,
          requestId: handlerContext.requestId,
        });
        if (!apiKeyResult.ok) {
          return jsonResponse(apiKeyResult.body, apiKeyResult.status);
        }

        if (
          organizationIdParam &&
          organizationIdParam !== apiKeyResult.value.organizationId
        ) {
          return jsonResponse(
            serviceErrorToHttp(
              { code: "FORBIDDEN", message: "API key organization mismatch." },
              handlerContext.requestId
            ).body,
            403
          );
        }

        return {
          organizationId: apiKeyResult.value.organizationId,
          projectIds: apiKeyResult.value.projectIds,
          requestId: handlerContext.requestId,
          scopes: apiKeyResult.value.scopes,
          type: "api_key",
        };
      }

      const authResult = requireSession(handlerContext);
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const orgId =
        organizationIdParam ??
        (authResult.value.session as { activeOrganizationId?: string | null })
          .activeOrganizationId;

      if (!orgId) {
        return jsonResponse(
          serviceErrorToHttp(
            { code: "FORBIDDEN", message: "Active workspace required." },
            authResult.value.requestId
          ).body,
          403
        );
      }

      const ctx = await resolveAuthContext(db, authResult.value, orgId);
      if ("error" in ctx) {
        return jsonResponse(
          serviceErrorToHttp(
            { code: "FORBIDDEN", message: "Active workspace required." },
            authResult.value.requestId
          ).body,
          403
        );
      }

      return {
        organizationId: ctx.organizationId,
        orgRole: ctx.orgRole,
        projectIds: ctx.projectIds,
        requestId: authResult.value.requestId,
        type: "session",
        userId: ctx.userId,
      };
    })
    .get("/api/v1/auth/scope-probe/:scope", async (context) => {
      if (process.env.NODE_ENV === "production") {
        return new Response(null, { status: 404 });
      }

      const handlerContext = context as unknown as SessionHandlerContext & {
        apiKeyAuth: import("@usebugreport/services").AuthContext | null;
      };

      const { requireApiKeyAuth, requireApiKeyScopeOnContext } = await import(
        "../middleware/api-key-auth"
      );
      const apiKeyResult = requireApiKeyAuth({
        apiKeyAuth: handlerContext.apiKeyAuth,
        request: context.request,
        requestId: handlerContext.requestId,
      });
      if (!apiKeyResult.ok) {
        return jsonResponse(apiKeyResult.body, apiKeyResult.status);
      }

      const scopeMap: Record<
        string,
        import("@usebugreport/services").ApiKeyScope
      > = {
        "mcp-tools": "mcp:tools",
        "reports-read": "reports:read",
        "reports-write": "reports:write",
        "webhooks-manage": "webhooks:manage",
      };

      const scope = scopeMap[context.params.scope];
      if (!scope) {
        return jsonResponse(
          {
            error: {
              code: "NOT_FOUND",
              message: "Unknown scope probe.",
              requestId: handlerContext.requestId,
            },
          },
          404
        );
      }

      const scopeResult = requireApiKeyScopeOnContext(
        apiKeyResult.value,
        scope,
        handlerContext.requestId
      );
      if (!scopeResult.ok) {
        return jsonResponse(scopeResult.body, scopeResult.status);
      }

      return { ok: true, requestId: handlerContext.requestId, scope };
    });
}
