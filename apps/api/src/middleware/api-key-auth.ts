import type { DbClient } from "@usebugreport/db";
import {
  type ApiKeyScope,
  type AuthContext,
  createApiKeyService,
  requireApiKeyScope,
} from "@usebugreport/services";
import { Elysia } from "elysia";
import { db } from "../lib/auth";
import {
  type ApiErrorEnvelope,
  createRequestId,
  forbiddenError,
  unauthorizedError,
} from "../lib/errors";

const LIVE_KEY_PREFIX = "ubr_live_";
const INGEST_KEY_PREFIX = "ubr_ingest_";

const apiKeyService = createApiKeyService(db);

export interface ApiKeyAuthContext {
  authContext: AuthContext | null;
}

export const apiKeyAuthMiddleware = new Elysia({
  name: "api-key-auth-middleware",
}).derive({ as: "global" }, async (context) => {
  const { request } = context;
  const requestId =
    "requestId" in context && typeof context.requestId === "string"
      ? context.requestId
      : createRequestId();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { apiKeyAuth: null as AuthContext | null };
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (token.startsWith(INGEST_KEY_PREFIX)) {
    return { apiKeyAuth: null as AuthContext | null };
  }

  if (!token.startsWith(LIVE_KEY_PREFIX)) {
    return { apiKeyAuth: null as AuthContext | null };
  }

  const validated = await apiKeyService.validateApiKey(token);
  if (!validated) {
    return { apiKeyAuth: null as AuthContext | null, invalidBearer: true };
  }

  const authContext = await apiKeyService.buildAuthContextFromApiKey(
    validated,
    requestId
  );

  return { apiKeyAuth: authContext, invalidBearer: false };
});

export function parseBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim();
}

export function requireApiKeyAuth(context: {
  apiKeyAuth: AuthContext | null;
  invalidBearer?: boolean;
  request: Request;
  requestId: string;
}):
  | { ok: true; value: AuthContext }
  | { ok: false; status: 401; body: ApiErrorEnvelope } {
  const token = parseBearerToken(context.request);

  if (token?.startsWith(INGEST_KEY_PREFIX)) {
    return {
      body: unauthorizedError(
        "Ingest keys cannot authenticate on this route.",
        context.requestId
      ),
      ok: false,
      status: 401,
    };
  }

  if (token?.startsWith(LIVE_KEY_PREFIX) && !context.apiKeyAuth) {
    return {
      body: unauthorizedError("Invalid or expired API key.", context.requestId),
      ok: false,
      status: 401,
    };
  }

  if (context.apiKeyAuth?.type !== "api_key") {
    return {
      body: unauthorizedError("API key required.", context.requestId),
      ok: false,
      status: 401,
    };
  }

  return { ok: true, value: context.apiKeyAuth };
}

export function requireSessionOrApiKey(context: {
  apiKeyAuth: AuthContext | null;
  request: Request;
  requestId: string;
  session: unknown | null;
  user: unknown | null;
}):
  | { ok: true; value: AuthContext; source: "api_key" }
  | { ok: true; source: "session" }
  | { ok: false; status: 401; body: ApiErrorEnvelope } {
  const token = parseBearerToken(context.request);

  if (token?.startsWith(INGEST_KEY_PREFIX)) {
    return {
      body: unauthorizedError(
        "Ingest keys cannot authenticate on this route.",
        context.requestId
      ),
      ok: false,
      status: 401,
    };
  }

  if (token?.startsWith(LIVE_KEY_PREFIX)) {
    const apiKeyResult = requireApiKeyAuth(context);
    if (!apiKeyResult.ok) {
      return apiKeyResult;
    }
    return {
      ok: true,
      source: "api_key",
      value: apiKeyResult.value,
    };
  }

  if (token) {
    return {
      body: unauthorizedError("Invalid or expired API key.", context.requestId),
      ok: false,
      status: 401,
    };
  }

  if (context.user && context.session) {
    return { ok: true, source: "session" };
  }

  return {
    body: unauthorizedError("Authentication required.", context.requestId),
    ok: false,
    status: 401,
  };
}

export function requireApiKeyScopeOnContext(
  ctx: AuthContext,
  scope: ApiKeyScope,
  requestId: string
): { ok: true } | { ok: false; status: 403; body: ApiErrorEnvelope } {
  try {
    requireApiKeyScope(ctx, scope);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Missing required scope.";
    return {
      body: forbiddenError(message, requestId),
      ok: false,
      status: 403,
    };
  }
}

export async function resolveApiKeyFromRequest(
  client: DbClient,
  authorization: string | null,
  requestId: string
): Promise<AuthContext | null> {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token.startsWith(LIVE_KEY_PREFIX)) {
    return null;
  }

  const service = createApiKeyService(client);
  const validated = await service.validateApiKey(token);
  if (!validated) {
    return null;
  }

  return service.buildAuthContextFromApiKey(validated, requestId);
}

export { apiKeyService };
