import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

const initializeBody = {
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" },
    protocolVersion: "2024-11-05",
  },
};

describe.skipIf(!hasDatabaseUrl())("mcp streamable http transport", () => {
  let app: typeof import("../index").app;
  let db: typeof import("../lib/auth").db;
  let apiKeyService: import("@usebugreport/services").ApiKeyService;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;
  let memberTable: typeof import("@usebugreport/db").schema.member;
  let userTable: typeof import("@usebugreport/db").schema.user;
  let projectsTable: typeof import("@usebugreport/db").schema.projects;

  const orgId = "org_mcp_transport";

  beforeAll(async () => {
    applyTestEnv();
    process.env.NODE_ENV = "test";

    const authMod = await import("../lib/auth");
    authMod.initAuth();
    ({ db } = authMod);

    const dbModule = await import("@usebugreport/db");
    organizationTable = dbModule.schema.organization;
    memberTable = dbModule.schema.member;
    userTable = dbModule.schema.user;
    projectsTable = dbModule.schema.projects;

    const servicesMod = await import("@usebugreport/services");
    apiKeyService = servicesMod.createApiKeyService(db);

    ({ app } = await import("../index"));
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

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: orgId,
      name: "MCP Org",
      slug: "mcp-org",
    });

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "mcp@example.com",
      emailVerified: true,
      id: "user_mcp",
      name: "MCP User",
      updatedAt: new Date(),
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_mcp",
      organizationId: orgId,
      role: "owner",
      userId: "user_mcp",
    });

    await db.insert(projectsTable).values({
      createdAt: new Date(),
      id: "proj_mcp",
      name: "MCP Project",
      organizationId: orgId,
      slug: "mcp-project",
      updatedAt: new Date(),
    });
  });

  async function seedKey(scopes: string[]): Promise<string> {
    const created = await apiKeyService.createApiKey(
      {
        organizationId: orgId,
        requestId: "req_mcp",
        type: "session",
        userId: "user_mcp",
      },
      { name: "mcp test", scopes }
    );
    return created.keyPlaintext;
  }

  test("missing bearer returns 401", async () => {
    const response = await app.handle(
      new Request("http://localhost/mcp", {
        body: JSON.stringify(initializeBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(response.status).toBe(401);
  });

  test("valid live key establishes MCP initialize response", async () => {
    const key = await seedKey(["reports:read", "mcp:tools"]);
    const response = await app.handle(
      new Request("http://localhost/mcp", {
        body: JSON.stringify(initializeBody),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).not.toBe(401);
    const text = await response.text();
    expect(text.length).toBeGreaterThan(0);
  });

  test("free tier read key rejects write probe tool call", async () => {
    const key = await seedKey(["reports:read", "mcp:tools"]);
    const callBody = {
      id: 2,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {},
        name: "reports_write_check",
      },
    };

    const response = await app.handle(
      new Request("http://localhost/mcp", {
        body: JSON.stringify(callBody),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).not.toBe(401);
    const payload = await response.text();
    expect(payload.toLowerCase()).toMatch(/forbidden|missing required scope/);
  });
});
