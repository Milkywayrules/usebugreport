import { cors } from "@elysiajs/cors";
import {
  createProjectService,
  createUsageService,
  createWorkspaceService,
  ServiceError,
  servicesReady,
} from "@usebugreport/services";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { auth, db, initAuth } from "./lib/auth";
import { getEnv } from "./lib/env";
import { serviceErrorToHttp } from "./lib/errors";
import { readJsonBody } from "./lib/request-body";
import { apiKeyAuthMiddleware } from "./middleware/api-key-auth";
import { onboardingGateMiddleware } from "./middleware/onboarding-gate";
import { requireSession, sessionMiddleware } from "./middleware/session";
import { registerApiKeyRoutes } from "./routes/api-keys";
import { registerProjectMemberRoutes } from "./routes/project-members";
import { registerProjectRoutes } from "./routes/projects";
import { registerUserPreferenceRoutes } from "./routes/user-preferences";
import { registerWorkspaceRoutes } from "./routes/workspaces";

initAuth();
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

const baseApp = new Elysia()
  .use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      origin: env.APP_URL,
    })
  )
  .use(sessionMiddleware)
  .use(apiKeyAuthMiddleware)
  .use(onboardingGateMiddleware)
  .mount(auth.handler)
  .get("/health", async () => {
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
  })
  .get("/", () => ({ message: "usebugreport api" }))
  .get("/api/v1/session", async (context) => {
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
  })
  .post("/api/v1/onboarding/workspace", async (context) => {
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
  });

const appWithRoutes = registerApiKeyRoutes(
  registerUserPreferenceRoutes(
    registerProjectMemberRoutes(
      registerProjectRoutes(registerWorkspaceRoutes(baseApp))
    )
  )
) as typeof baseApp;

let app = appWithRoutes as typeof baseApp;

app = app.get("/api/v1/protected-probe", (context) => {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const authResult = requireSession(
    context as unknown as Parameters<typeof requireSession>[0]
  );
  if (!authResult.ok) {
    return jsonResponse(authResult.body, authResult.status);
  }

  return { ok: true };
}) as unknown as typeof baseApp;

export { app };

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3001);
  app.listen({ hostname: "0.0.0.0", port });
}
