import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  apikey,
  member,
  organization,
  projects,
  user,
  workspaceApiKeys,
} from "@usebugreport/db";
import { eq, sql } from "drizzle-orm";
import { createApiKeyService, generateLiveKeyPlaintext } from "./api-key";
import type { AuthContext } from "./types";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

function sessionCtx(
  organizationId: string,
  userId: string,
  requestId = "req_test"
): AuthContext {
  return {
    organizationId,
    requestId,
    type: "session",
    userId,
  };
}

runDbTests("ApiKeyService", () => {
  let db: DbClient;
  let apiKeyService: ReturnType<typeof createApiKeyService>;

  const orgFree = "org_api_key_free";
  const orgPro = "org_api_key_pro";
  const adminUser = "user_api_key_admin";
  const memberUser = "user_api_key_member";

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    const mod = await import("@usebugreport/db");
    db = mod.createDbClient(databaseUrl);
    apiKeyService = createApiKeyService(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table
        workspace_api_keys,
        project_members,
        ingest_keys,
        projects,
        user_preferences,
        reports,
        report_blobs,
        workspace_usage_monthly,
        apikey,
        invitation,
        member,
        organization,
        verification,
        account,
        session,
        "user"
      restart identity cascade
    `);

    await db.insert(user).values([
      {
        createdAt: new Date(),
        email: "admin@example.com",
        emailVerified: true,
        id: adminUser,
        name: "Admin",
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: "member@example.com",
        emailVerified: true,
        id: memberUser,
        name: "Member",
        updatedAt: new Date(),
      },
    ]);

    await db.insert(organization).values([
      {
        billingTier: "free",
        createdAt: new Date(),
        id: orgFree,
        name: "Free Org",
        slug: "free-org",
      },
      {
        billingTier: "pro",
        createdAt: new Date(),
        id: orgPro,
        name: "Pro Org",
        slug: "pro-org",
      },
    ]);

    await db.insert(member).values([
      {
        createdAt: new Date(),
        id: "member_admin_free",
        organizationId: orgFree,
        role: "admin",
        userId: adminUser,
      },
      {
        createdAt: new Date(),
        id: "member_member_free",
        organizationId: orgFree,
        role: "member",
        userId: memberUser,
      },
      {
        createdAt: new Date(),
        id: "member_admin_pro",
        organizationId: orgPro,
        role: "admin",
        userId: adminUser,
      },
    ]);

    await db.insert(projects).values({
      id: "prj_api_key",
      name: "Main",
      organizationId: orgFree,
      slug: "main",
    });
  });

  test("creates key with dual-table sync and hash verify", async () => {
    const result = await apiKeyService.createApiKey(
      sessionCtx(orgFree, adminUser),
      {
        name: "CI",
        scopes: ["reports:read", "mcp:tools"],
      }
    );

    expect(result.keyPlaintext).toStartWith("ubr_live_");
    expect(result.apiKey.keyPrefix).toBe(result.keyPlaintext.slice(-8));

    const validated = await apiKeyService.validateApiKey(result.keyPlaintext);
    expect(validated?.organizationId).toBe(orgFree);
    expect(validated?.scopes).toEqual(["reports:read", "mcp:tools"]);

    const pluginRow = await db.query.apikey.findFirst({
      where: eq(apikey.id, result.apiKey.id),
    });
    expect(pluginRow?.enabled).toBe(true);
    expect(pluginRow?.prefix).toBe("ubr_live_");
    expect(pluginRow?.referenceId).toBe(orgFree);
  });

  test("rejects free-tier write scopes at create", async () => {
    await expect(
      apiKeyService.createApiKey(sessionCtx(orgFree, adminUser), {
        name: "Write",
        scopes: ["reports:write"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("allows pro-tier write scopes", async () => {
    const result = await apiKeyService.createApiKey(
      sessionCtx(orgPro, adminUser),
      {
        name: "Write",
        scopes: ["reports:write", "webhooks:manage"],
      }
    );
    expect(result.apiKey.scopes).toContain("reports:write");
  });

  test("rejects unknown scopes", async () => {
    await expect(
      apiKeyService.createApiKey(sessionCtx(orgFree, adminUser), {
        name: "Bad",
        scopes: ["invalid:scope"],
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("rejects non-admin create", async () => {
    await expect(
      apiKeyService.createApiKey(sessionCtx(orgFree, memberUser), {
        name: "Nope",
        scopes: ["reports:read"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("rotate revokes old key and issues new plaintext", async () => {
    const created = await apiKeyService.createApiKey(
      sessionCtx(orgFree, adminUser),
      { name: "Rotate", scopes: ["reports:read"] }
    );

    const rotated = await apiKeyService.rotateApiKey(
      sessionCtx(orgFree, adminUser),
      created.apiKey.id
    );

    expect(await apiKeyService.validateApiKey(created.keyPlaintext)).toBeNull();
    expect(
      await apiKeyService.validateApiKey(rotated.keyPlaintext)
    ).not.toBeNull();

    const oldRow = await db.query.workspaceApiKeys.findFirst({
      where: eq(workspaceApiKeys.id, created.apiKey.id),
    });
    expect(oldRow?.revokedAt).not.toBeNull();
  });

  test("revoke disables key", async () => {
    const created = await apiKeyService.createApiKey(
      sessionCtx(orgFree, adminUser),
      { name: "Revoke", scopes: ["mcp:tools"] }
    );

    await apiKeyService.revokeApiKey(
      sessionCtx(orgFree, adminUser),
      created.apiKey.id
    );

    expect(await apiKeyService.validateApiKey(created.keyPlaintext)).toBeNull();
    const pluginRow = await db.query.apikey.findFirst({
      where: eq(apikey.id, created.apiKey.id),
    });
    expect(pluginRow?.enabled).toBe(false);
  });

  test("rejects expired keys", async () => {
    const plaintext = generateLiveKeyPlaintext();
    const keyHash = await (
      globalThis as typeof globalThis & {
        Bun: { password: { hash: typeof Bun.password.hash } };
      }
    ).Bun.password.hash(plaintext, {
      algorithm: "bcrypt",
      cost: 10,
    });
    const keyId = "wak_expired_test";

    await db.insert(workspaceApiKeys).values({
      expiresAt: new Date(Date.now() - 60_000),
      id: keyId,
      keyHash,
      keyPrefix: plaintext.slice(-8),
      name: "Expired",
      organizationId: orgFree,
      scopes: ["reports:read"],
    });

    expect(await apiKeyService.validateApiKey(plaintext)).toBeNull();
  });

  test("touchLastUsed updates timestamp", async () => {
    const created = await apiKeyService.createApiKey(
      sessionCtx(orgFree, adminUser),
      { name: "Touch", scopes: ["reports:read"] }
    );

    await apiKeyService.touchLastUsed(created.apiKey.id);
    const row = await db.query.workspaceApiKeys.findFirst({
      where: eq(workspaceApiKeys.id, created.apiKey.id),
    });
    expect(row?.lastUsedAt).not.toBeNull();
  });

  test("cross-org revoke guard", async () => {
    const created = await apiKeyService.createApiKey(
      sessionCtx(orgFree, adminUser),
      { name: "Cross", scopes: ["reports:read"] }
    );

    await expect(
      apiKeyService.revokeApiKey(
        sessionCtx(orgPro, adminUser),
        created.apiKey.id
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("list returns masked rows without plaintext", async () => {
    const created = await apiKeyService.createApiKey(
      sessionCtx(orgFree, adminUser),
      { name: "Listed", scopes: ["reports:read"] }
    );

    const listed = await apiKeyService.listApiKeys(
      sessionCtx(orgFree, adminUser)
    );
    expect(listed.some((row) => row.id === created.apiKey.id)).toBe(true);
    expect(JSON.stringify(listed)).not.toContain(created.keyPlaintext);
  });
});
