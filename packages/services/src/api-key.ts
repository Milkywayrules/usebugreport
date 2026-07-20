import type { BillingTier } from "@usebugreport/config";
import { getTierLimits } from "@usebugreport/config";
import type { DbClient } from "@usebugreport/db";
import {
  apikey,
  member,
  organization,
  projects,
  workspaceApiKeys,
} from "@usebugreport/db";
import { and, eq, isNull } from "drizzle-orm";
import { generatePrefixedId } from "./project";
import type { ApiKeyScope, AuthContext } from "./types";
import {
  API_KEY_SCOPES,
  FREE_TIER_API_KEY_SCOPES,
  ServiceError,
} from "./types";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LIVE_KEY_PREFIX = "ubr_live_";

const bunRuntime = globalThis as typeof globalThis & {
  Bun?: {
    password: {
      hash: (
        password: string,
        options: { algorithm: string; cost: number }
      ) => Promise<string>;
      verify: (password: string, hash: string) => Promise<boolean>;
    };
  };
};

export interface ApiKeyRow {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  name: string;
  revokedAt: Date | null;
  scopes: ApiKeyScope[];
}

export interface CreateApiKeyResult {
  apiKey: ApiKeyRow;
  keyPlaintext: string;
}

function randomBase62(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (const byte of bytes) {
    result += BASE62[byte % BASE62.length];
  }
  return result;
}

export function generateLiveKeyPlaintext(): string {
  return `${LIVE_KEY_PREFIX}${randomBase62(32)}`;
}

function hashApiKey(plaintext: string): Promise<string> {
  const bun = bunRuntime.Bun;
  if (!bun) {
    return Promise.reject(
      new ServiceError("VALIDATION_ERROR", "Password hashing unavailable.")
    );
  }
  return bun.password.hash(plaintext, { algorithm: "bcrypt", cost: 10 });
}

function verifyApiKey(plaintext: string, hash: string): Promise<boolean> {
  const bun = bunRuntime.Bun;
  if (!bun) {
    return Promise.resolve(false);
  }
  return bun.password.verify(plaintext, hash);
}

function mapApiKeyRow(row: typeof workspaceApiKeys.$inferSelect): ApiKeyRow {
  return {
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    id: row.id,
    keyPrefix: row.keyPrefix,
    lastUsedAt: row.lastUsedAt,
    name: row.name,
    revokedAt: row.revokedAt,
    scopes: row.scopes as ApiKeyScope[],
  };
}

function validateScopeInput(scopes: string[]): ApiKeyScope[] {
  if (scopes.length === 0) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      "At least one scope is required."
    );
  }

  const invalid = scopes.filter(
    (scope) => !API_KEY_SCOPES.includes(scope as ApiKeyScope)
  );
  if (invalid.length > 0) {
    throw new ServiceError("VALIDATION_ERROR", "Invalid API key scope.", {
      invalidScopes: invalid,
    });
  }

  return scopes as ApiKeyScope[];
}

async function requireOrgAdmin(
  db: DbClient,
  ctx: AuthContext,
  organizationId: string
): Promise<void> {
  if (!ctx.userId) {
    throw new ServiceError("FORBIDDEN", "Organization admin access required.");
  }

  const row = await db.query.member.findFirst({
    columns: { role: true },
    where: and(
      eq(member.userId, ctx.userId),
      eq(member.organizationId, organizationId)
    ),
  });

  if (!row || (row.role !== "owner" && row.role !== "admin")) {
    throw new ServiceError("FORBIDDEN", "Organization admin access required.");
  }
}

async function assertFreeTierScopesAllowed(
  db: DbClient,
  organizationId: string,
  scopes: ApiKeyScope[]
): Promise<void> {
  const org = await db.query.organization.findFirst({
    columns: { billingTier: true },
    where: eq(organization.id, organizationId),
  });

  if (!org) {
    throw new ServiceError("NOT_FOUND", "Workspace not found.");
  }

  const tier = org.billingTier as BillingTier;
  const limits = getTierLimits(tier);

  const disallowed = scopes.filter(
    (scope) => !FREE_TIER_API_KEY_SCOPES.includes(scope)
  );

  if (disallowed.length > 0 && !limits.mcpWriteAllowed) {
    throw new ServiceError(
      "FORBIDDEN",
      "Write and webhook scopes require a Pro plan or higher.",
      { disallowedScopes: disallowed }
    );
  }
}

async function insertApiKeyPair(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  input: {
    expiresAt: Date | null;
    id: string;
    keyHash: string;
    keyPrefix: string;
    name: string;
    organizationId: string;
    scopes: ApiKeyScope[];
  }
) {
  const now = new Date();

  await tx.insert(workspaceApiKeys).values({
    expiresAt: input.expiresAt,
    id: input.id,
    keyHash: input.keyHash,
    keyPrefix: input.keyPrefix,
    name: input.name,
    organizationId: input.organizationId,
    scopes: input.scopes,
  });

  await tx.insert(apikey).values({
    createdAt: now,
    enabled: true,
    expiresAt: input.expiresAt,
    id: input.id,
    key: input.keyHash,
    metadata: JSON.stringify({
      scopes: input.scopes,
      workspaceApiKeyId: input.id,
    }),
    name: input.name,
    prefix: LIVE_KEY_PREFIX,
    referenceId: input.organizationId,
    updatedAt: now,
  });
}

async function disableApiKeyPair(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  keyId: string
) {
  const now = new Date();
  await tx
    .update(workspaceApiKeys)
    .set({ revokedAt: now })
    .where(eq(workspaceApiKeys.id, keyId));
  await tx
    .update(apikey)
    .set({ enabled: false, updatedAt: now })
    .where(eq(apikey.id, keyId));
}

export function requireApiKeyScope(ctx: AuthContext, scope: ApiKeyScope): void {
  if (ctx.type !== "api_key") {
    throw new ServiceError("FORBIDDEN", "API key scope required.");
  }

  if (!ctx.scopes?.includes(scope)) {
    throw new ServiceError("FORBIDDEN", `Missing required scope: ${scope}.`);
  }
}

export function createApiKeyService(db: DbClient) {
  return {
    assertOrganizationMatch(ctx: AuthContext, organizationId: string): void {
      if (ctx.organizationId !== organizationId) {
        throw new ServiceError("FORBIDDEN", "API key organization mismatch.");
      }
    },

    async buildAuthContextFromApiKey(
      validated: {
        apiKeyId: string;
        organizationId: string;
        scopes: ApiKeyScope[];
      },
      requestId: string
    ): Promise<AuthContext> {
      const projectRows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.organizationId, validated.organizationId));

      try {
        await this.touchLastUsed(validated.apiKeyId);
      } catch {
        // last_used_at is best-effort; auth must not fail if touch errors
      }

      return {
        apiKeyId: validated.apiKeyId,
        organizationId: validated.organizationId,
        projectIds: projectRows.map((row) => row.id),
        requestId,
        scopes: validated.scopes,
        type: "api_key",
      };
    },
    async createApiKey(
      ctx: AuthContext,
      input: { expiresAt?: string | null; name: string; scopes: string[] }
    ): Promise<CreateApiKeyResult> {
      await requireOrgAdmin(db, ctx, ctx.organizationId);

      const name = input.name.trim();
      if (!name) {
        throw new ServiceError("VALIDATION_ERROR", "API key name is required.");
      }

      const scopes = validateScopeInput(input.scopes);
      await assertFreeTierScopesAllowed(db, ctx.organizationId, scopes);

      let expiresAt: Date | null = null;
      if (input.expiresAt) {
        expiresAt = new Date(input.expiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            "Expiry must be a future date."
          );
        }
      }

      const keyPlaintext = generateLiveKeyPlaintext();
      const keyPrefix = keyPlaintext.slice(-8);
      const keyHash = await hashApiKey(keyPlaintext);
      const keyId = generatePrefixedId("wak");

      await db.transaction(async (tx) => {
        await insertApiKeyPair(tx, {
          expiresAt,
          id: keyId,
          keyHash,
          keyPrefix,
          name,
          organizationId: ctx.organizationId,
          scopes,
        });
      });

      const row = await db.query.workspaceApiKeys.findFirst({
        where: eq(workspaceApiKeys.id, keyId),
      });

      if (!row) {
        throw new ServiceError("NOT_FOUND", "API key not found.");
      }

      return { apiKey: mapApiKeyRow(row), keyPlaintext };
    },

    async listApiKeys(ctx: AuthContext): Promise<ApiKeyRow[]> {
      await requireOrgAdmin(db, ctx, ctx.organizationId);

      const rows = await db.query.workspaceApiKeys.findMany({
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        where: and(
          eq(workspaceApiKeys.organizationId, ctx.organizationId),
          isNull(workspaceApiKeys.revokedAt)
        ),
      });

      return rows.map(mapApiKeyRow);
    },

    async revokeApiKey(ctx: AuthContext, keyId: string): Promise<void> {
      await requireOrgAdmin(db, ctx, ctx.organizationId);

      const existing = await db.query.workspaceApiKeys.findFirst({
        where: and(
          eq(workspaceApiKeys.id, keyId),
          eq(workspaceApiKeys.organizationId, ctx.organizationId),
          isNull(workspaceApiKeys.revokedAt)
        ),
      });

      if (!existing) {
        throw new ServiceError("NOT_FOUND", "API key not found.");
      }

      await db.transaction(async (tx) => {
        await disableApiKeyPair(tx, keyId);
      });
    },

    async rotateApiKey(
      ctx: AuthContext,
      keyId: string
    ): Promise<CreateApiKeyResult> {
      await requireOrgAdmin(db, ctx, ctx.organizationId);

      const existing = await db.query.workspaceApiKeys.findFirst({
        where: and(
          eq(workspaceApiKeys.id, keyId),
          eq(workspaceApiKeys.organizationId, ctx.organizationId),
          isNull(workspaceApiKeys.revokedAt)
        ),
      });

      if (!existing) {
        throw new ServiceError("NOT_FOUND", "API key not found.");
      }

      const scopes = existing.scopes as ApiKeyScope[];
      await assertFreeTierScopesAllowed(db, ctx.organizationId, scopes);

      const keyPlaintext = generateLiveKeyPlaintext();
      const keyPrefix = keyPlaintext.slice(-8);
      const keyHash = await hashApiKey(keyPlaintext);
      const newKeyId = generatePrefixedId("wak");

      await db.transaction(async (tx) => {
        await disableApiKeyPair(tx, keyId);
        await insertApiKeyPair(tx, {
          expiresAt: existing.expiresAt,
          id: newKeyId,
          keyHash,
          keyPrefix,
          name: existing.name,
          organizationId: ctx.organizationId,
          scopes,
        });
      });

      const row = await db.query.workspaceApiKeys.findFirst({
        where: eq(workspaceApiKeys.id, newKeyId),
      });

      if (!row) {
        throw new ServiceError("NOT_FOUND", "API key not found.");
      }

      return { apiKey: mapApiKeyRow(row), keyPlaintext };
    },

    async touchLastUsed(keyId: string): Promise<void> {
      const now = new Date();
      await db
        .update(workspaceApiKeys)
        .set({ lastUsedAt: now })
        .where(eq(workspaceApiKeys.id, keyId));
      await db
        .update(apikey)
        .set({ lastRequest: now, updatedAt: now })
        .where(eq(apikey.id, keyId));
    },

    async validateApiKey(plaintext: string): Promise<{
      apiKeyId: string;
      organizationId: string;
      scopes: ApiKeyScope[];
    } | null> {
      if (!plaintext.startsWith(LIVE_KEY_PREFIX)) {
        return null;
      }

      const activeKeys = await db
        .select({
          expiresAt: workspaceApiKeys.expiresAt,
          id: workspaceApiKeys.id,
          keyHash: workspaceApiKeys.keyHash,
          organizationId: workspaceApiKeys.organizationId,
          revokedAt: workspaceApiKeys.revokedAt,
          scopes: workspaceApiKeys.scopes,
        })
        .from(workspaceApiKeys)
        .where(isNull(workspaceApiKeys.revokedAt));

      const matches = await Promise.all(
        activeKeys.map(async (row) => ({
          row,
          valid: await verifyApiKey(plaintext, row.keyHash),
        }))
      );

      const match = matches.find((entry) => entry.valid);
      if (!match) {
        return null;
      }

      if (match.row.revokedAt) {
        return null;
      }

      if (match.row.expiresAt && match.row.expiresAt <= new Date()) {
        return null;
      }

      return {
        apiKeyId: match.row.id,
        organizationId: match.row.organizationId,
        scopes: match.row.scopes as ApiKeyScope[],
      };
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;

export { LIVE_KEY_PREFIX };
