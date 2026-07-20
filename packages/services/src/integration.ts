import type { IntegrationsLinearPushPayload } from "@usebugreport/queue";
import { createLinearPushHandlers } from "./integration-linear-push";

import { createHmac } from "node:crypto";
import type { DbClient } from "@usebugreport/db";
import { integrations, projects } from "@usebugreport/db";
import { and, eq, isNull } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "./crypto/secrets";
import { generatePrefixedId } from "./project";
import { createRBACService } from "./rbac";
import type { AuthContext } from "./types";
import { requireSessionUserId, ServiceError } from "./types";
import type { UsageService } from "./usage";

export interface LinearOAuthTokenSet {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

export interface IntegrationServiceDeps {
  appUrl: string;
  encryptionKey: string;
  linearClientId: string;
  linearClientSecret: string;
  usageService: UsageService;
  enqueueLinearPush?: (
    payload: IntegrationsLinearPushPayload
  ) => Promise<void>;
}

interface LinearIntegrationConfig {
  defaultTeamId?: string | null;
}

function signStateBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function encodeState(payload: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signStateBody(body, secret)}`;
}

function decodeState<T extends Record<string, unknown>>(
  state: string,
  secret: string
): T {
  const [body, mac] = state.split(".");
  if (!body || !mac) {
    throw new ServiceError("VALIDATION_ERROR", "Invalid OAuth state.");
  }
  if (signStateBody(body, secret) !== mac) {
    throw new ServiceError("VALIDATION_ERROR", "Invalid OAuth state.");
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

async function exchangeLinearCode(
  deps: IntegrationServiceDeps,
  code: string
): Promise<LinearOAuthTokenSet> {
  const response = await fetch("https://api.linear.app/oauth/token", {
    body: new URLSearchParams({
      client_id: deps.linearClientId,
      client_secret: deps.linearClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${deps.appUrl.replace(/\/$/, "")}/api/v1/integrations/linear/callback`,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Linear OAuth token exchange failed."
    );
  }

  return (await response.json()) as LinearOAuthTokenSet;
}

async function refreshLinearToken(
  deps: IntegrationServiceDeps,
  refreshToken: string
): Promise<LinearOAuthTokenSet> {
  const response = await fetch("https://api.linear.app/oauth/token", {
    body: new URLSearchParams({
      client_id: deps.linearClientId,
      client_secret: deps.linearClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "Linear token refresh failed."
    );
  }

  return (await response.json()) as LinearOAuthTokenSet;
}

function tokenExpiresAt(tokens: LinearOAuthTokenSet): number | undefined {
  if (!tokens.expires_in) {
    return;
  }
  return Date.now() + tokens.expires_in * 1000;
}

export function createIntegrationService(
  db: DbClient,
  deps: IntegrationServiceDeps
) {
  const rbac = createRBACService(db);
  async function readActiveLinear(organizationId: string) {
    return db.query.integrations.findFirst({
      where: and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.type, "linear"),
        isNull(integrations.revokedAt)
      ),
    });
  }

  async function persistTokens(
    integrationId: string,
    tokens: LinearOAuthTokenSet
  ) {
    const payload = JSON.stringify({
      ...tokens,
      expires_at: tokenExpiresAt(tokens),
    });
    const encrypted = await encryptSecret(payload, deps.encryptionKey);
    await db
      .update(integrations)
      .set({ oauthTokensEncrypted: encrypted })
      .where(eq(integrations.id, integrationId));
  }

  async function loadTokens(integrationId: string): Promise<LinearOAuthTokenSet & {
    expires_at?: number;
  }> {
    const row = await db.query.integrations.findFirst({
      columns: { oauthTokensEncrypted: true },
      where: eq(integrations.id, integrationId),
    });
    if (!row) {
      throw new ServiceError("NOT_FOUND", "Integration not found.");
    }
    const json = await decryptSecret(row.oauthTokensEncrypted, deps.encryptionKey);
    return JSON.parse(json) as LinearOAuthTokenSet & { expires_at?: number };
  }

  async function ensureFreshAccessToken(integrationId: string): Promise<string> {
    const tokens = await loadTokens(integrationId);
    if (
      tokens.expires_at &&
      tokens.expires_at <= Date.now() + 60_000 &&
      tokens.refresh_token
    ) {
      const refreshed = await refreshLinearToken(deps, tokens.refresh_token);
      await persistTokens(integrationId, refreshed);
      return refreshed.access_token;
    }
    return tokens.access_token;
  }

  const linearPush = createLinearPushHandlers(db, deps, {
    ensureFreshAccessToken,
    rbac,
    readActiveLinear,
  });

  return {
    async connectLinear(
      ctx: AuthContext,
      input: { code: string; state: string }
    ): Promise<{ connected: true }> {
      requireSessionUserId(ctx);
      const parsed = decodeState<{
        organizationId: string;
        userId: string;
      }>(input.state, deps.encryptionKey);
      if (
        parsed.organizationId !== ctx.organizationId ||
        parsed.userId !== ctx.userId
      ) {
        throw new ServiceError("FORBIDDEN", "OAuth state mismatch.");
      }

      const limit = await deps.usageService.checkTierLimit(ctx, "integrations");
      if (!limit.allowed) {
        throw new ServiceError("QUOTA_EXCEEDED", limit.message, limit.details);
      }

      const existing = await readActiveLinear(ctx.organizationId);
      if (existing) {
        throw new ServiceError("CONFLICT", "Linear is already connected.");
      }

      const tokenSet = await exchangeLinearCode(deps, input.code);
      const encrypted = await encryptSecret(
        JSON.stringify({
          ...tokenSet,
          expires_at: tokenExpiresAt(tokenSet),
        }),
        deps.encryptionKey
      );

      await db.insert(integrations).values({
        config: {},
        id: generatePrefixedId("int"),
        oauthTokensEncrypted: encrypted,
        organizationId: ctx.organizationId,
        type: "linear",
      });

      return { connected: true };
    },

    async disconnectLinear(ctx: AuthContext): Promise<void> {
      requireSessionUserId(ctx);
      const row = await readActiveLinear(ctx.organizationId);
      if (!row) {
        return;
      }

      await db
        .update(integrations)
        .set({ revokedAt: new Date() })
        .where(eq(integrations.id, row.id));
    },

    getLinearAuthorizeUrl(ctx: AuthContext): { state: string; url: string } {
      requireSessionUserId(ctx);
      const state = encodeState(
        {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
        },
        deps.encryptionKey
      );
      const redirectUri = `${deps.appUrl.replace(/\/$/, "")}/api/v1/integrations/linear/callback`;
      const params = new URLSearchParams({
        client_id: deps.linearClientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "read,write,issues:create",
        state,
      });
      return {
        state,
        url: `https://linear.app/oauth/authorize?${params.toString()}`,
      };
    },

    async getLinearStatus(ctx: AuthContext): Promise<{
      connected: boolean;
      connectedAt?: string;
      config?: LinearIntegrationConfig;
    }> {
      const row = await readActiveLinear(ctx.organizationId);
      if (!row) {
        return { connected: false };
      }
      return {
        connected: true,
        connectedAt: row.connectedAt.toISOString(),
        config: (row.config ?? {}) as LinearIntegrationConfig,
      };
    },

    async listLinearTeams(ctx: AuthContext): Promise<
      Array<{ id: string; name: string }>
    > {
      const row = await readActiveLinear(ctx.organizationId);
      if (!row) {
        throw new ServiceError("NOT_FOUND", "Linear is not connected.");
      }
      const accessToken = await ensureFreshAccessToken(row.id);
      const response = await fetch("https://api.linear.app/graphql", {
        body: JSON.stringify({
          query: "{ teams { nodes { id name } } }",
        }),
        headers: {
          Authorization: accessToken,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new ServiceError("VALIDATION_ERROR", "Failed to load Linear teams.");
      }
      const body = (await response.json()) as {
        data?: { teams?: { nodes?: Array<{ id: string; name: string }> } };
      };
      return body.data?.teams?.nodes ?? [];
    },

    processLinearPushJob: linearPush.processLinearPushJob,
    pushReportToLinear: linearPush.pushReportToLinear,

    async updateProjectDefaultLinearTeam(
      ctx: AuthContext,
      projectId: string,
      teamId: string | null
    ): Promise<void> {
      requireSessionUserId(ctx);
      const allowed = await rbac.canPerform(ctx, projectId, "integration:manage");
      if (!allowed) {
        throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
      }
      const row = await readActiveLinear(ctx.organizationId);
      if (!row) {
        throw new ServiceError("NOT_FOUND", "Linear is not connected.");
      }

      await db
        .update(projects)
        .set({ defaultLinearTeamId: teamId })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.organizationId, ctx.organizationId)
          )
        );
    },
  };
}

export type IntegrationService = ReturnType<typeof createIntegrationService>;
