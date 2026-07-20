import { Elysia } from "elysia";
import { auth } from "../lib/auth";
import { createRequestId, unauthorizedError } from "../lib/errors";

export interface SessionContext {
  requestId: string;
  session: NonNullable<
    Awaited<ReturnType<typeof auth.api.getSession>>
  >["session"];
  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];
}

export const sessionMiddleware = new Elysia({
  name: "session-middleware",
}).derive({ as: "global" }, async ({ request }) => {
  const requestId = createRequestId();
  const session = await auth.api.getSession({ headers: request.headers });

  return {
    requestId,
    session: session?.session ?? null,
    user: session?.user ?? null,
  };
});

export function requireSession(context: {
  requestId: string;
  session: SessionContext["session"] | null;
  user: SessionContext["user"] | null;
}):
  | { ok: true; value: SessionContext }
  | { ok: false; status: 401; body: ReturnType<typeof unauthorizedError> } {
  if (!(context.user && context.session)) {
    return {
      body: unauthorizedError("Authentication required.", context.requestId),
      ok: false,
      status: 401,
    };
  }

  return {
    ok: true,
    value: {
      requestId: context.requestId,
      session: context.session,
      user: context.user,
    },
  };
}
