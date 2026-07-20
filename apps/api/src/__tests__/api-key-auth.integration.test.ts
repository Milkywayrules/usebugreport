import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { eq, sql } from "drizzle-orm";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

describe.skipIf(!hasDatabaseUrl())("api key auth integration", () => {
  let app: typeof import("../index").app;
  let db: typeof import("../lib/auth").db;
  let apiKeyService: import("@usebugreport/services").ApiKeyService;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;
  let memberTable: typeof import("@usebugreport/db").schema.member;
  let userTable: typeof import("@usebugreport/db").schema.user;
  let sessionTable: typeof import("@usebugreport/db").schema.session;
  let projectsTable: typeof import("@usebugreport/db").schema.projects;
  let workspaceApiKeysTable: typeof import("@usebugreport/db").schema.workspaceApiKeys;

  const orgA = "org_key_a";
  const orgB = "org_key_b";
  const adminUser = "user_key_admin";
  const memberUser = "user_key_member";

  beforeAll(async () => {
    if (!hasDatabaseUrl()) {
      return;
    }

    applyTestEnv();
    process.env.NODE_ENV = "test";

    const authMod = await import("../lib/auth");
    authMod.initAuth();
    ({ db } = authMod);

    const dbModule = await import("@usebugreport/db");
    organizationTable = dbModule.schema.organization;
    memberTable = dbModule.schema.member;
    userTable = dbModule.schema.user;
    sessionTable = dbModule.schema.session;
    projectsTable = dbModule.schema.projects;
    workspaceApiKeysTable = dbModule.schema.workspaceApiKeys;

    const servicesMod = await import("@usebugreport/services");
    apiKeyService = servicesMod.createApiKeyService(db);

    const { app: apiApp } = await import("../index");
    app = apiApp;
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

    await db.insert(organizationTable).values([
      {
        billingTier: "free",
        createdAt: new Date(),
        id: orgA,
        name: "Org A",
        slug: "org-a",
      },
      {
        billingTier: "pro",
        createdAt: new Date(),
        id: orgB,
        name: "Org B",
        slug: "org-b",
      },
    ]);

    await db.insert(projectsTable).values([
      {
        id: "prj_a",
        name: "Project A",
        organizationId: orgA,
        slug: "project-a",
      },
      {
        id: "prj_b",
        name: "Project B",
        organizationId: orgB,
        slug: "project-b",
      },
    ]);

    await db.insert(userTable).values([
      {
        createdAt: new Date(),
        email: "admin@key.test",
        emailVerified: true,
        id: adminUser,
        name: "Admin",
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: "member@key.test",
        emailVerified: true,
        id: memberUser,
        name: "Member",
        updatedAt: new Date(),
      },
    ]);

    await db.insert(memberTable).values([
      {
        createdAt: new Date(),
        id: "member_admin_a",
        organizationId: orgA,
        role: "admin",
        userId: adminUser,
      },
      {
        createdAt: new Date(),
        id: "member_member_a",
        organizationId: orgA,
        role: "member",
        userId: memberUser,
      },
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`select 1`);
  });

  async function createSessionCookie(userId: string, orgId: string) {
    const token = `token_${userId}`;
    await db.insert(sessionTable).values({
      activeOrganizationId: orgId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: `session_${userId}`,
      token,
      updatedAt: new Date(),
      userId,
    });

    const { makeSignature } = await import("better-auth/crypto");
    const secret =
      process.env.BETTER_AUTH_SECRET ??
      "test-better-auth-secret-min-32-characters";
    const signed = `${token}.${await makeSignature(token, secret)}`;
    return `better-auth.session_token=${signed}`;
  }

  function seedKey(input: { organizationId: string; scopes: string[] }) {
    return apiKeyService.createApiKey(
      {
        organizationId: input.organizationId,
        type: "session",
        userId: adminUser,
      },
      { name: "Test", scopes: input.scopes }
    );
  }

  test("valid bearer returns api_key context on probe", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["reports:read", "mcp:tools"],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: { Authorization: `Bearer ${created.keyPlaintext}` },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      organizationId: string;
      projectIds: string[];
      scopes: string[];
      type: string;
    };
    expect(body.type).toBe("api_key");
    expect(body.organizationId).toBe(orgA);
    expect(body.scopes).toContain("reports:read");
    expect(body.projectIds).toContain("prj_a");
  });

  test("revoked key returns 401", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["reports:read"],
    });

    await apiKeyService.revokeApiKey(
      { organizationId: orgA, type: "session", userId: adminUser },
      created.apiKey.id
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: { Authorization: `Bearer ${created.keyPlaintext}` },
      })
    );
    expect(response.status).toBe(401);
  });

  test("expired key returns 401", async () => {
    const plaintext = (
      await import("@usebugreport/services")
    ).generateLiveKeyPlaintext();
    const keyHash = await (
      globalThis as typeof globalThis & {
        Bun: { password: { hash: typeof Bun.password.hash } };
      }
    ).Bun.password.hash(plaintext, {
      algorithm: "bcrypt",
      cost: 10,
    });

    await db.insert(workspaceApiKeysTable).values({
      expiresAt: new Date(Date.now() - 60_000),
      id: "wak_expired_integration",
      keyHash,
      keyPrefix: plaintext.slice(-8),
      name: "Expired",
      organizationId: orgA,
      scopes: ["reports:read"],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: { Authorization: `Bearer ${plaintext}` },
      })
    );
    expect(response.status).toBe(401);
  });

  test("ingest prefix on v1 probe returns 401", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: {
          Authorization: "Bearer ubr_ingest_abc123456789012345678901234567890",
        },
      })
    );
    expect(response.status).toBe(401);
  });

  test("cross-org probe param returns 403", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["reports:read"],
    });

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/auth/context-probe?organizationId=${orgB}`,
        { headers: { Authorization: `Bearer ${created.keyPlaintext}` } }
      )
    );
    expect([401, 403]).toContain(response.status);
  });

  test("missing scope returns 403 on scope probe", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["mcp:tools"],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/scope-probe/reports-read", {
        headers: { Authorization: `Bearer ${created.keyPlaintext}` },
      })
    );
    expect(response.status).toBe(403);
  });

  test("valid scope probe returns 200", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["reports:read"],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/scope-probe/reports-read", {
        headers: { Authorization: `Bearer ${created.keyPlaintext}` },
      })
    );
    expect(response.status).toBe(200);
  });

  test("session admin create returns plaintext once", async () => {
    const cookie = await createSessionCookie(adminUser, orgA);
    const response = await app.handle(
      new Request(`http://localhost/api/v1/workspaces/${orgA}/api-keys`, {
        body: JSON.stringify({
          name: "Integration",
          scopes: ["reports:read", "mcp:tools"],
        }),
        headers: { "Content-Type": "application/json", cookie },
        method: "POST",
      })
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      apiKey: { id: string };
      keyPlaintext: string;
    };
    expect(body.keyPlaintext).toStartWith("ubr_live_");
  });

  test("free org create with write scope returns 403", async () => {
    const cookie = await createSessionCookie(adminUser, orgA);
    const response = await app.handle(
      new Request(`http://localhost/api/v1/workspaces/${orgA}/api-keys`, {
        body: JSON.stringify({
          name: "Write",
          scopes: ["reports:write"],
        }),
        headers: { "Content-Type": "application/json", cookie },
        method: "POST",
      })
    );
    expect(response.status).toBe(403);
  });

  test("org member list keys returns 403", async () => {
    const cookie = await createSessionCookie(memberUser, orgA);
    const response = await app.handle(
      new Request(`http://localhost/api/v1/workspaces/${orgA}/api-keys`, {
        headers: { cookie },
      })
    );
    expect(response.status).toBe(403);
  });

  test("rotate invalidates old key immediately", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["reports:read"],
    });
    const cookie = await createSessionCookie(adminUser, orgA);

    const rotateResponse = await app.handle(
      new Request(
        `http://localhost/api/v1/workspaces/${orgA}/api-keys/${created.apiKey.id}/rotate`,
        { headers: { cookie }, method: "POST" }
      )
    );
    expect(rotateResponse.status).toBe(200);
    const rotated = (await rotateResponse.json()) as { keyPlaintext: string };

    const oldProbe = await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: { Authorization: `Bearer ${created.keyPlaintext}` },
      })
    );
    expect(oldProbe.status).toBe(401);

    const newProbe = await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: { Authorization: `Bearer ${rotated.keyPlaintext}` },
      })
    );
    expect(newProbe.status).toBe(200);
  });

  test("last_used_at advances on auth", async () => {
    const created = await seedKey({
      organizationId: orgA,
      scopes: ["reports:read"],
    });

    const before = await db.query.workspaceApiKeys.findFirst({
      where: eq(workspaceApiKeysTable.id, created.apiKey.id),
    });

    await app.handle(
      new Request("http://localhost/api/v1/auth/context-probe", {
        headers: { Authorization: `Bearer ${created.keyPlaintext}` },
      })
    );

    const after = await db.query.workspaceApiKeys.findFirst({
      where: eq(workspaceApiKeysTable.id, created.apiKey.id),
    });

    expect(after?.lastUsedAt).not.toBeNull();
    if (before?.lastUsedAt && after?.lastUsedAt) {
      expect(after.lastUsedAt.getTime()).toBeGreaterThanOrEqual(
        before.lastUsedAt.getTime()
      );
    }
  });
});
