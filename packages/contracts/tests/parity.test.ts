import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { SURFACE_REGISTRY } from "../src/surface-registry";
import { sql } from "drizzle-orm";
import { applyTestEnv, hasDatabaseUrl } from "./test-env";

const launchReadEntries = SURFACE_REGISTRY.filter(
  (entry) => entry.launchGate !== false && entry.rest.method === "GET"
);

describe.skipIf(!hasDatabaseUrl())("REST parity over live HTTP", () => {
  let baseUrl: string;
  let server: ReturnType<typeof Bun.serve>;
  let db: import("../../../packages/db/src/index.ts").DbClient;
  let apiKeyService: import("../../../packages/services/src/index.ts").ApiKeyService;
  let organizationTable: typeof import("../../../packages/db/src/index.ts").schema.organization;
  let projectsTable: typeof import("../../../packages/db/src/index.ts").schema.projects;
  let reportsTable: typeof import("../../../packages/db/src/index.ts").schema.reports;
  let memberTable: typeof import("../../../packages/db/src/index.ts").schema.member;
  let userTable: typeof import("../../../packages/db/src/index.ts").schema.user;

  const orgId = "org_rest_parity";
  const projectId = "prj_rest_parity";
  const reportId = "rpt_rest_parity_a";
  const reportIdB = "rpt_rest_parity_b";
  const adminUser = "user_rest_parity_admin";

  beforeAll(async () => {
    applyTestEnv();
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL ??=
      "postgresql://test:test@127.0.0.1:5432/usebugreport_test";

    const authMod = await import("../../../apps/api/src/lib/auth");
    authMod.initAuth();
    db = authMod.db;

    const dbModule = await import("../../../packages/db/src/index.ts");
    organizationTable = dbModule.schema.organization;
    projectsTable = dbModule.schema.projects;
    reportsTable = dbModule.schema.reports;
    memberTable = dbModule.schema.member;
    userTable = dbModule.schema.user;

    const servicesMod = await import("../../../packages/services/src/index.ts");
    apiKeyService = servicesMod.createApiKeyService(db);

    const { app } = await import("../../../apps/api/src/index");
    server = Bun.serve({
      fetch: app.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    baseUrl = `http://${server.hostname}:${server.port}`;
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
      name: "REST Parity Org",
      slug: "rest-parity",
    });

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "admin@rest-parity.test",
      emailVerified: true,
      id: adminUser,
      name: "Admin",
      updatedAt: new Date(),
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_rest_parity",
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

    const now = new Date();
    await db.insert(reportsTable).values([
      {
        createdAt: new Date(now.getTime() - 60_000),
        description: "Older checkout issue",
        id: reportId,
        ingestStatus: "ready",
        organizationId: orgId,
        projectId,
        status: "open",
        summaryText: "console.error: payment failed",
        title: "Checkout bug",
        updatedAt: new Date(now.getTime() - 60_000),
      },
      {
        createdAt: now,
        description: "Newer search target",
        id: reportIdB,
        ingestStatus: "ready",
        organizationId: orgId,
        projectId,
        status: "open",
        summaryText: "warn: retry",
        title: "Searchable checkout regression",
        updatedAt: now,
      },
    ]);
  });

  afterAll(() => {
    server.stop(true);
  });

  async function seedKey(scopes: string[]) {
    const created = await apiKeyService.createApiKey(
      {
        organizationId: orgId,
        type: "session",
        userId: adminUser,
      },
      { name: "parity-read", scopes }
    );
    return created.keyPlaintext;
  }

  function pathForEntry(pathTemplate: string): string {
    if (pathTemplate.endsWith("/search")) {
      return `${pathTemplate}?q=checkout&limit=10`;
    }
    if (pathTemplate.includes(":id")) {
      return pathTemplate.replace(":id", reportId);
    }
    return `${pathTemplate}?limit=10`;
  }

  test("registry read operations respond over HTTP fetch", async () => {
    const key = await seedKey(["reports:read"]);

    for (const entry of launchReadEntries) {
      const path = pathForEntry(entry.rest.path);
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${key}` },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data?: unknown;
        requestId?: string;
      };
      expect(body.data).toBeDefined();
      expect(typeof body.requestId).toBe("string");
    }
  });

  test("invalid Bearer key returns UNAUTHORIZED envelope", async () => {
    const response = await fetch(`${baseUrl}/api/v1/reports`, {
      headers: { Authorization: "Bearer ubr_live_invalid_key_value" },
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId.length).toBeGreaterThan(0);
  });

  test("missing reports:read scope returns FORBIDDEN envelope", async () => {
    const key = await seedKey(["mcp:tools"]);

    const response = await fetch(`${baseUrl}/api/v1/reports`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("cursor pagination encodes next page over HTTP", async () => {
    const key = await seedKey(["reports:read"]);

    const first = await fetch(`${baseUrl}/api/v1/reports?limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      data: Array<{ id: string }>;
      page: { hasMore: boolean; nextCursor?: string | null };
    };
    expect(firstBody.data.length).toBe(1);
    expect(firstBody.page.hasMore).toBe(true);
    expect(firstBody.page.nextCursor).toBeTruthy();

    const second = await fetch(
      `${baseUrl}/api/v1/reports?limit=1&cursor=${encodeURIComponent(firstBody.page.nextCursor ?? "")}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as {
      data: Array<{ id: string }>;
      page: { hasMore: boolean };
    };
    expect(secondBody.data.length).toBe(1);
    expect(secondBody.data[0]?.id).not.toBe(firstBody.data[0]?.id);
  });

  test("status filter query param is honored", async () => {
    const key = await seedKey(["reports:read"]);

    await db
      .update(reportsTable)
      .set({ status: "resolved" })
      .where(sql`id = ${reportId}`);

    const response = await fetch(`${baseUrl}/api/v1/reports?status=resolved`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }> };
    expect(body.data.every((row) => row.id === reportId)).toBe(true);
  });
});
