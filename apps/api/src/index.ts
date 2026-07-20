import { cors } from "@elysiajs/cors";
import { servicesPlaceholder } from "@usebugreport/services";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { auth, db, initAuth } from "./lib/auth";
import { getEnv } from "./lib/env";
import { requireSession, sessionMiddleware } from "./middleware/session";

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
  .mount(auth.handler)
  .get("/health", async () => {
    try {
      await db.execute(sql`select 1`);
      return {
        database: "ok",
        services: servicesPlaceholder,
        status: "ok",
      };
    } catch {
      return {
        database: "error",
        services: servicesPlaceholder,
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
  });

if (import.meta.main) {
  app.listen({ hostname: "0.0.0.0", port: 3001 });
}
