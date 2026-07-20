import {
  type AuthContext,
  type WebhookService,
  requireApiKeyScope,
  ServiceError,
} from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { INTEGRATION_PUBLIC_TAG } from "../lib/route-tags";
import { resolveAuthContext } from "../middleware/auth-context";
import { requireSession } from "../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

export interface WebhookRouteDeps {
  webhookService: WebhookService;
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

async function resolveManageContext(
  context: unknown
): Promise<
  | { ok: true; ctx: AuthContext; requestId: string }
  | { ok: false; body: unknown; status: number }
> {
  const ctx = context as SessionHandlerContext & {
    apiKeyAuth?: AuthContext | null;
    requestId?: string;
  };
  const requestId = ctx.requestId ?? crypto.randomUUID();

  if (ctx.apiKeyAuth) {
    requireApiKeyScope(ctx.apiKeyAuth, "webhooks:manage");
    return { ctx: ctx.apiKeyAuth, ok: true, requestId };
  }

  const authResult = requireSession(ctx);
  if (!authResult.ok) {
    return { body: authResult.body, ok: false, status: authResult.status };
  }

  const resolved = await resolveAuthContext(db, authResult.value);
  if ("error" in resolved) {
    return {
      body: {
        error: {
          code: "FORBIDDEN",
          message: "Active workspace required.",
          requestId: authResult.value.requestId,
        },
      },
      ok: false,
      status: 403,
    };
  }

  return { ctx: resolved, ok: true, requestId: authResult.value.requestId };
}

export function registerWebhookRoutes(app: unknown, deps: WebhookRouteDeps): unknown {
  const routeApp = app as Elysia;
  const { webhookService } = deps;

  return routeApp
    .get("/api/v1/webhooks/deliveries", async (context) => {
      const access = await resolveManageContext(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }

      try {
        const data = await webhookService.listDeliveries(access.ctx);
        return {
          data: data.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
          requestId: access.requestId,
        };
      } catch (error) {
        return handleServiceError(error, access.requestId);
      }
    }, { detail: { tags: [INTEGRATION_PUBLIC_TAG] } })
    .get("/api/v1/webhooks", async (context) => {
      const access = await resolveManageContext(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }

      try {
        const data = await webhookService.listEndpoints(access.ctx);
        return {
          data: data.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
          requestId: access.requestId,
        };
      } catch (error) {
        return handleServiceError(error, access.requestId);
      }
    }, { detail: { tags: [INTEGRATION_PUBLIC_TAG] } })
    .post("/api/v1/webhooks", async (context) => {
      const access = await resolveManageContext(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }

      const body = await readJsonBody<{
        enabled?: boolean;
        events?: string[];
        url?: string;
      }>(context.request);

      if (!body?.url || !body.events) {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "url and events are required.",
              requestId: access.requestId,
            },
          },
          422
        );
      }

      try {
        const data = await webhookService.register(access.ctx, {
          enabled: body.enabled,
          events: body.events as never,
          url: body.url,
        });
        return {
          data: {
            ...data,
            createdAt: data.createdAt.toISOString(),
          },
          requestId: access.requestId,
        };
      } catch (error) {
        return handleServiceError(error, access.requestId);
      }
    }, { detail: { tags: [INTEGRATION_PUBLIC_TAG] } });
}
