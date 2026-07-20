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

const requestIdPattern = /^req_/;

describe.skipIf(!hasDatabaseUrl())("workspace and project integration", () => {
  let app: typeof import("../index").app;
  let auth: typeof import("../lib/auth").auth;
  let db: typeof import("../lib/auth").db;
  let sessionTable: typeof import("@usebugreport/db").schema.session;
  let userTable: typeof import("@usebugreport/db").schema.user;
  let memberTable: typeof import("@usebugreport/db").schema.member;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;

  beforeAll(async () => {
    if (!hasDatabaseUrl()) {
      return;
    }

    applyTestEnv();

    const authMod = await import("../lib/auth");
    authMod.initAuth();
    ({ auth, db } = authMod);
    const dbModule = await import("@usebugreport/db");
    sessionTable = dbModule.schema.session;
    userTable = dbModule.schema.user;
    memberTable = dbModule.schema.member;
    organizationTable = dbModule.schema.organization;

    const { app: apiApp } = await import("../index");
    app = apiApp;
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table
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
  });

  afterAll(async () => {
    await db.execute(sql`select 1`);
  });

  async function createSessionFixture(userId = "user_integration") {
    const token = "session-token-integration-1234567890";

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "integration@example.com",
      emailVerified: true,
      id: userId,
      name: "Integration User",
      updatedAt: new Date(),
    });

    await db.insert(sessionTable).values({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: "session_integration",
      token,
      updatedAt: new Date(),
      userId,
    });

    return { token, userId };
  }

  async function sessionCookieHeaders(token: string): Promise<HeadersInit> {
    const { makeSignature } = await import("better-auth/crypto");
    const ctx = await auth.$context;
    const cookieName = ctx.authCookies.sessionToken.name;
    const signedToken = `${token}.${await makeSignature(token, ctx.secret)}`;
    return { cookie: `${cookieName}=${signedToken}` };
  }

  test("creates first workspace on free tier", async () => {
    const { token } = await createSessionFixture();
    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/workspaces", {
        body: JSON.stringify({ name: "Acme" }),
        headers: {
          ...(await sessionCookieHeaders(token)),
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      organization: { slug: string };
    };
    expect(body.organization.slug).toBe("acme");
  });

  test("blocks second workspace on free tier", async () => {
    const userId = "user_free_limit";
    const { token } = await createSessionFixture(userId);

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_free_1",
      name: "First",
      slug: "first",
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_free_1",
      organizationId: "org_free_1",
      role: "owner",
      userId,
    });

    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/workspaces", {
        body: JSON.stringify({ name: "Second" }),
        headers: {
          ...(await sessionCookieHeaders(token)),
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.requestId).toMatch(requestIdPattern);
  });

  test("blocks raw better-auth organization create at limit", async () => {
    const userId = "user_raw_org";
    const { token } = await createSessionFixture(userId);

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_raw_1",
      name: "Existing",
      slug: "existing-raw",
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_raw_1",
      organizationId: "org_raw_1",
      role: "owner",
      userId,
    });

    const response = await app.handle(
      new Request("http://localhost:3001/api/auth/organization/create", {
        body: JSON.stringify({ name: "Bypass", slug: "bypass" }),
        headers: {
          ...(await sessionCookieHeaders(token)),
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("creates project with ingest key and rotates it", async () => {
    const userId = "user_project_flow";
    const { token } = await createSessionFixture(userId);
    const headers = {
      ...(await sessionCookieHeaders(token)),
      "Content-Type": "application/json",
    };

    const workspaceResponse = await app.handle(
      new Request("http://localhost:3001/api/v1/workspaces", {
        body: JSON.stringify({ name: "Project Org" }),
        headers,
        method: "POST",
      })
    );
    expect(workspaceResponse.status).toBe(201);
    const workspaceBody = (await workspaceResponse.json()) as {
      organization: { id: string; slug: string };
    };

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: workspaceBody.organization.id })
      .where(eq(sessionTable.userId, userId));

    const createProjectResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/workspaces/${workspaceBody.organization.id}/projects`,
        {
          body: JSON.stringify({ name: "Web" }),
          headers,
          method: "POST",
        }
      )
    );

    expect(createProjectResponse.status).toBe(201);
    const projectBody = (await createProjectResponse.json()) as {
      ingestKeyPlaintext: string;
      project: { id: string };
    };
    expect(projectBody.ingestKeyPlaintext.startsWith("ubr_ingest_")).toBe(true);

    const rotateResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${projectBody.project.id}/ingest-keys/rotate`,
        {
          headers,
          method: "POST",
        }
      )
    );

    expect(rotateResponse.status).toBe(200);
    const rotateBody = (await rotateResponse.json()) as {
      ingestKeyPlaintext: string;
    };
    expect(rotateBody.ingestKeyPlaintext).not.toBe(
      projectBody.ingestKeyPlaintext
    );

    const { createProjectService } = await import("@usebugreport/services");
    const projectService = createProjectService(db);
    expect(
      await projectService.validateIngestKey(projectBody.ingestKeyPlaintext)
    ).toBeNull();
    expect(
      await projectService.validateIngestKey(rotateBody.ingestKeyPlaintext)
    ).toEqual({
      organizationId: workspaceBody.organization.id,
      projectId: projectBody.project.id,
    });
  });

  test("denies project read with wrong organization context", async () => {
    const userId = "user_cross_org";
    const { token } = await createSessionFixture(userId);
    const headers = {
      ...(await sessionCookieHeaders(token)),
      "Content-Type": "application/json",
    };

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_a",
      name: "Org A",
      slug: "org-a",
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_a",
      organizationId: "org_a",
      role: "owner",
      userId,
    });

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_b",
      name: "Org B",
      slug: "org-b",
    });

    const { createProjectService } = await import("@usebugreport/services");
    const projectService = createProjectService(db);
    const created = await projectService.createProject(
      { organizationId: "org_b", type: "session", userId },
      { name: "Secret" }
    );

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: "org_a" })
      .where(eq(sessionTable.userId, userId));

    const response = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${created.project.id}`,
        { headers, method: "GET" }
      )
    );

    expect(response.status).toBe(404);
  });

  test("rejects 10th pinned workspace", async () => {
    const userId = "user_pins_api";
    const { token } = await createSessionFixture(userId);
    const headers = {
      ...(await sessionCookieHeaders(token)),
      "Content-Type": "application/json",
    };

    const orgIds = Array.from({ length: 10 }, (_, index) => `org_api_${index}`);
    await Promise.all(
      orgIds.map(async (orgId, index) => {
        await db.insert(organizationTable).values({
          billingTier: "free",
          createdAt: new Date(),
          id: orgId,
          name: `Org ${index}`,
          slug: `org-api-${index}`,
        });
        await db.insert(memberTable).values({
          createdAt: new Date(),
          id: `member_api_${orgId}`,
          organizationId: orgId,
          role: "owner",
          userId,
        });
      })
    );

    const response = await app.handle(
      new Request("http://localhost:3001/api/v1/user/preferences", {
        body: JSON.stringify({ pinnedWorkspaceIds: orgIds }),
        headers,
        method: "PATCH",
      })
    );

    expect(response.status).toBe(422);
  });
});
