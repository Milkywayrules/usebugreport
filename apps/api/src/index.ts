import { cors } from "@elysiajs/cors";
import { createUsageService, servicesReady } from "@usebugreport/services";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { auth, db, initAuth } from "./lib/auth";
import { getEnv } from "./lib/env";
import { onboardingGateMiddleware } from "./middleware/onboarding-gate";
import { requireSession, sessionMiddleware } from "./middleware/session";

function slugifyWorkspaceName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

initAuth();
const env = getEnv();

export const app = new Elysia()
  .use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      origin: env.APP_URL,
    })
  )
  .use(sessionMiddleware)
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
      return new Response(JSON.stringify(authResult.body), {
        headers: { "Content-Type": "application/json" },
        status: authResult.status,
      });
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
  .get("/api/v1/protected-probe", (context) => {
    const authResult = requireSession(context);
    if (!authResult.ok) {
      return new Response(JSON.stringify(authResult.body), {
        headers: { "Content-Type": "application/json" },
        status: authResult.status,
      });
    }

    return { ok: true };
  })
  .post("/api/v1/onboarding/workspace", async (context) => {
    const authResult = requireSession(context);
    if (!authResult.ok) {
      return new Response(JSON.stringify(authResult.body), {
        headers: { "Content-Type": "application/json" },
        status: authResult.status,
      });
    }

    let body: { name?: string };
    try {
      body = (await context.request.json()) as { name?: string };
    } catch {
      return new Response(
        JSON.stringify({
          error: { message: "Invalid request body." },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 422,
        }
      );
    }

    const trimmedName = body.name?.trim();
    if (!trimmedName) {
      return new Response(
        JSON.stringify({
          error: { message: "Workspace name is required." },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 422,
        }
      );
    }

    const usageService = createUsageService(db);
    const tierCheck = await usageService.checkTierLimit(
      { organizationId: "", userId: authResult.value.user.id },
      "workspaces"
    );

    if (!tierCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: {
            code: tierCheck.code,
            message: tierCheck.message,
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    const slug = slugifyWorkspaceName(trimmedName);

    const organization = await (
      auth.api as unknown as {
        createOrganization: (input: {
          body: { name: string; slug: string };
          headers: Headers;
        }) => Promise<{ id: string; slug: string }>;
      }
    ).createOrganization({
      body: { name: trimmedName, slug },
      headers: context.request.headers,
    });

    await (
      auth.api as unknown as {
        setActiveOrganization: (input: {
          body: { organizationId: string };
          headers: Headers;
        }) => Promise<unknown>;
      }
    ).setActiveOrganization({
      body: { organizationId: organization.id },
      headers: context.request.headers,
    });

    return { organization: { slug: organization.slug } };
  });

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3001);
  app.listen({ hostname: "0.0.0.0", port });
}
