import type { DbClient } from "@usebugreport/db";
import type { AuthContext } from "@usebugreport/services";
import type { ApiErrorEnvelope } from "../lib/errors";
import {
  requireApiKeyScopeOnContext,
  requireSessionOrApiKey,
} from "./api-key-auth";
import { resolveAuthContext } from "./auth-context";
import type { SessionContext } from "./session";

export type ReportAccessRequestContext = {
  apiKeyAuth: AuthContext | null;
  request: Request;
  requestId: string;
  session: SessionContext["session"] | null;
  user: SessionContext["user"] | null;
};

export async function resolveReportReadAccess(
  db: DbClient,
  context: ReportAccessRequestContext
): Promise<
  | { ok: true; ctx: AuthContext; requestId: string }
  | { ok: false; status: number; body: ApiErrorEnvelope }
> {
  const authResult = requireSessionOrApiKey(context);
  if (!authResult.ok) {
    return authResult;
  }

  if (authResult.source === "api_key") {
    const scopeResult = requireApiKeyScopeOnContext(
      authResult.value,
      "reports:read",
      context.requestId
    );
    if (!scopeResult.ok) {
      return scopeResult;
    }

    return {
      ctx: authResult.value,
      ok: true,
      requestId: context.requestId,
    };
  }

  if (!(context.user && context.session)) {
    return {
      body: {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
          requestId: context.requestId,
        },
      },
      ok: false,
      status: 401,
    };
  }

  const sessionContext: SessionContext = {
    requestId: context.requestId,
    session: context.session,
    user: context.user,
  };
  const resolved = await resolveAuthContext(db, sessionContext);
  if ("error" in resolved) {
    return {
      body: {
        error: {
          code: "FORBIDDEN",
          message: "Active workspace required.",
          requestId: context.requestId,
        },
      },
      ok: false,
      status: 403,
    };
  }

  return { ctx: resolved, ok: true, requestId: context.requestId };
}
