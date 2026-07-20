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

describe.skipIf(!hasDatabaseUrl())("reports REST api key auth", () => {
  let app: typeof import("../index").app;
  let db: typeof import("../lib/auth").db;
  let apiKeyService: import("@usebugreport/services").ApiKeyService;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;
  let projectsTable: typeof import("@usebugreport/db").schema.projects;
  let reportsTable: typeof import("@usebugreport/db").schema.reports;
  let memberTable: typeof import("@usebugreport/db").schema.member;
  let userTable: typeof import("@usebugreport/db").schema.user;

  const orgId = "org_reports_rest";
  const projectId = "prj_reports_rest";
  const reportId = "rpt_reports_rest";
  const adminUser = "user_reports_rest_admin";

  beforeAll(async () => {
    applyTestEnv();
    process.env.NODE_ENV = "test";

    const authMod = await import("../lib/auth");
    authMod.initAuth();
    ({ db } = authMod);

    const dbModule = await import("@usebugreport/db");
    organizationTable = dbModule.schema.organization;
    projectsTable = dbModule.schema.projects;
    reportsTable = dbModule.schema.reports;
    memberTable = dbModule.schema.member;
    userTable = dbModule.schema.user;

    const servicesMod = await import("@usebugreport/services");
    apiKeyService = servicesMod.createApiKeyService(db);

    const { app: apiApp } = await import("../index");
    app = apiApp;
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table
        workspace_api_keys,
        report_comments,
        project_members,
        ingest_keys,
        report_blobs,
        reports,
        projects,
        workspace_usage_monthly,
        member,
        organization,
        session,
        "user"
      restart identity cascade
    `);

    await db.insert(organizationTable).values({
      billingTier: "pro",
      createdAt: new Date(),
      id: orgId,
      name: "Reports REST Org",
      slug: "reports-rest",
    });


    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "admin@reports-rest.test",
      emailVerified: true,
      id: adminUser,
      name: "Admin",
      updatedAt: new Date(),
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_reports_rest",
      organizationId: orgId,
      role: "admin",
      userId: adminUser,
    });

    await db.insert(projectsTable).values({
      id: projectId,
      name: "Main",
      organizationId: orgId,
      slug: "main",
    });

    await db.insert(reportsTable).values({
      createdAt: new Date(),
      description: "Test report",
      id: reportId,
      ingestStatus: "ready",
      organizationId: orgId,
      projectId,
      status: "open",
      title: "Checkout bug",
      updatedAt: new Date(),
    });
  });

  afterAll(() => {
    // no-op
  });

  async function seedKey(scopes: string[]) {
    const created = await apiKeyService.createApiKey(
      {
        organizationId: orgId,
        type: "session",
        userId: adminUser,
      },
      { name: "rest-read", scopes }
    );
    return created.keyPlaintext;
  }

  test("Bearer reports:read lists reports", async () => {
    const key = await seedKey(["reports:read"]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/reports?limit=10", {
        headers: { Authorization: `Bearer ${key}` },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ id: string; title: string }>;
      page: { hasMore: boolean };
    };
    expect(body.data.some((row) => row.id === reportId)).toBe(true);
    expect(body.page.hasMore).toBe(false);
  });

  test("Bearer reports:read gets report by id", async () => {
    const key = await seedKey(["reports:read"]);

    const response = await app.handle(
      new Request(`http://localhost/api/v1/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { title: string } };
    expect(body.data.title).toBe("Checkout bug");
  });

  test("missing reports:read scope returns 403", async () => {
    const key = await seedKey(["mcp:tools"]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/reports", {
        headers: { Authorization: `Bearer ${key}` },
      })
    );

    expect(response.status).toBe(403);
  });

  test("invalid Bearer live key returns 401", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/reports", {
        headers: { Authorization: "Bearer ubr_live_invalid_key_value" },
      })
    );

    expect(response.status).toBe(401);
  });
});
