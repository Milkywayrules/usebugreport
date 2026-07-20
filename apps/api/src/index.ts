import { cors } from "@elysiajs/cors";
import {
  createQueue,
  getActiveFinalizeCount,
  ingestFinalizePayloadSchema,
  JOB_NAMES,
  QUEUE_NAMES,
} from "@usebugreport/queue";
import {
  createCaptureIngestService,
  createProjectService,
  createUsageService,
  createWorkspaceService,
  ServiceError,
  servicesReady,
} from "@usebugreport/services";
import { createR2Client } from "@usebugreport/storage";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { auth, db, initAuth } from "./lib/auth";
import { getEnv } from "./lib/env";
import { serviceErrorToHttp } from "./lib/errors";
import { renderPrometheusMetrics } from "./lib/metrics";
import { readJsonBody } from "./lib/request-body";
import { ROUTE_TAGS } from "./lib/route-tags";
import { apiKeyAuthMiddleware } from "./middleware/api-key-auth";
import { onboardingGateMiddleware } from "./middleware/onboarding-gate";
import { requireSession, sessionMiddleware } from "./middleware/session";
import { initApiLogger, loggingPlugin } from "./plugins/logging";
import { observabilityPlugin } from "./plugins/observability";
import { attachOpenapiRoutes } from "./plugins/openapi";
import { platformErrorPlugin, requestIdPlugin } from "./plugins/platform-error";
import { securityPlugin } from "./plugins/security";
import { registerApiKeyRoutes } from "./routes/api-keys";
import { registerCaptureRoutes } from "./routes/capture";
import { registerProjectMemberRoutes } from "./routes/project-members";
import { registerProjectRoutes } from "./routes/projects";
import { registerUserPreferenceRoutes } from "./routes/user-preferences";
import { registerWorkspaceRoutes } from "./routes/workspaces";

initAuth();
initApiLogger();
const env = getEnv();

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

const usageService = createUsageService(db);
const workspaceService = createWorkspaceService(db, {
  authApi: {
    getSession: auth.api.getSession,
  },
  usageService,
});
const projectService = createProjectService(db);
const r2Client = createR2Client({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  accountId: env.R2_ACCOUNT_ID,
  bucket: env.R2_BUCKET,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
});
const ingestQueue = createQueue(
  QUEUE_NAMES.INGEST,
  ingestFinalizePayloadSchema
);
const captureIngestService = createCaptureIngestService(db, {
  getActiveFinalizeCount,
  enqueueFinalize: async (payload) => {
    await ingestQueue.add(
      JOB_NAMES.INGEST_FINALIZE,
      ingestFinalizePayloadSchema.parse(payload),
      { jobId: `${payload.projectId}-${payload.idempotencyKey}` }
    );
  },
  r2: r2Client,
  usageService,
});

const baseApp = new Elysia()
  .use(observabilityPlugin)
  .use(securityPlugin)
  .use(requestIdPlugin)
  .use(loggingPlugin)
  .use(platformErrorPlugin)
  .use(
    cors({
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Ingest-Key",
        "Idempotency-Key",
        "X-Request-Id",
      ],
      credentials: true,
      exposeHeaders: ["X-Request-Id"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      origin: env.APP_URL,
    })
  )
  .use(sessionMiddleware)
  .use(apiKeyAuthMiddleware)
  .use(onboardingGateMiddleware)
  .mount(auth.handler)
  .get(
    "/health",
    async () => {
      try {
        await db.execute(sql`select 1`);
        return {
          database: "ok",
          services: servicesReady,
          status: "ok",
        };
      } catch {
        return {
          database: "error",
          services: servicesReady,
          status: "degraded",
        };
      }
    },
    {
      detail: {
        hide: true,
        tags: [ROUTE_TAGS.ops],
      },
    }
  )
  .get(
    "/metrics",
    () =>
      new Response(renderPrometheusMetrics(), {
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      }),
    {
      detail: {
        hide: true,
        tags: [ROUTE_TAGS.ops],
      },
    }
  )
  .get("/", () => ({ message: "usebugreport api" }), {
    detail: { hide: true },
  })
  .get(
    "/api/v1/session",
    async (context) => {
      const authResult = requireSession(context);
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const organizations = await (
        auth.api as unknown as {
          listOrganizations: (input: {
            headers: Headers;
          }) => Promise<unknown[] | null>;
        }
      ).listOrganizations({
        headers: context.request.headers,
      });

      return {
        organizations: organizations ?? [],
        requestId: authResult.value.requestId,
        session: authResult.value.session,
        user: authResult.value.user,
      };
    },
    {
      detail: {
        hide: true,
        tags: [ROUTE_TAGS.sessionBff],
      },
    }
  )
  .post(
    "/api/v1/onboarding/workspace",
    async (context) => {
      const authResult = requireSession(context);
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const body = readJsonBody<{
        name?: string;
        projectName?: string;
        slug?: string;
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
        const ctx = {
          organizationId: "",
          requestId: authResult.value.requestId,
          type: "session" as const,
          userId: authResult.value.user.id,
        };

        const organization = await workspaceService.createWorkspace(
          ctx,
          { name: body.name ?? "", slug: body.slug },
          context.request.headers
        );

        let project:
          | Awaited<ReturnType<typeof projectService.createProject>>["project"]
          | undefined;
        let ingestKeyPlaintext: string | undefined;

        const projectName = body.projectName?.trim();
        if (projectName) {
          const created = await projectService.createProject(
            {
              ...ctx,
              organizationId: organization.id,
            },
            { name: projectName }
          );
          ({ ingestKeyPlaintext, project } = created);
        }

        return {
          ingestKeyPlaintext,
          organization: { id: organization.id, slug: organization.slug },
          project,
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    },
    {
      detail: {
        hide: true,
        tags: [ROUTE_TAGS.onboarding],
      },
    }
  );

const appWithRoutes = registerCaptureRoutes(
  registerApiKeyRoutes(
    registerUserPreferenceRoutes(
      registerProjectMemberRoutes(
        registerProjectRoutes(registerWorkspaceRoutes(baseApp))
      )
    )
  ),
  {
    captureIngestService,
    projectService,
  }
) as typeof baseApp;

const appWithProbes =
  process.env.NODE_ENV === "production"
    ? appWithRoutes.get(
        "/api/v1/protected-probe",
        (context) => {
          if (process.env.NODE_ENV === "production") {
            return new Response(null, { status: 404 });
          }

          const authResult = requireSession(context);
          if (!authResult.ok) {
            return jsonResponse(authResult.body, authResult.status);
          }

          return { ok: true };
        },
        {
          detail: {
            hide: true,
            tags: [ROUTE_TAGS.internalDev],
          },
        }
      )
    : appWithRoutes
        .get(
          "/api/v1/protected-probe",
          (context) => {
            if (process.env.NODE_ENV === "production") {
              return new Response(null, { status: 404 });
            }

            const authResult = requireSession(context);
            if (!authResult.ok) {
              return jsonResponse(authResult.body, authResult.status);
            }

            return { ok: true };
          },
          {
            detail: {
              hide: true,
              tags: [ROUTE_TAGS.internalDev],
            },
          }
        )
        .get(
          "/api/v1/_test/platform/error",
          () => {
            throw new Error("platform test error");
          },
          {
            detail: {
              hide: true,
              tags: [ROUTE_TAGS.internalDev],
            },
          }
        );

const coreApp = attachOpenapiRoutes(
  appWithProbes as unknown as Elysia
) as unknown as typeof appWithProbes;

export { coreApp as app };

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3001);
  coreApp.listen({ hostname: "0.0.0.0", port });
}
