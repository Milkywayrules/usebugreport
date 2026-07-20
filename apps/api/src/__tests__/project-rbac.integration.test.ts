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

const databaseUrl = process.env.DATABASE_URL;
const runIntegration = hasDatabaseUrl() ? describe : describe.skip;

runIntegration("project RBAC integration", () => {
  let app: typeof import("../index").app;
  let auth: typeof import("../lib/auth").auth;
  let db: typeof import("../lib/auth").db;
  let sessionTable: typeof import("@usebugreport/db").schema.session;
  let userTable: typeof import("@usebugreport/db").schema.user;
  let memberTable: typeof import("@usebugreport/db").schema.member;
  let organizationTable: typeof import("@usebugreport/db").schema.organization;
  let projectsTable: typeof import("@usebugreport/db").schema.projects;
  let projectMembersTable: typeof import("@usebugreport/db").schema.projectMembers;
  let ingestKeysTable: typeof import("@usebugreport/db").schema.ingestKeys;

  const orgId = "org_rbac_integration";
  const projectA = "prj_rbac_a";
  const projectB = "prj_rbac_b";

  beforeAll(async () => {
    if (!databaseUrl) {
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
    projectsTable = dbModule.schema.projects;
    projectMembersTable = dbModule.schema.projectMembers;
    ingestKeysTable = dbModule.schema.ingestKeys;

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

    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: orgId,
      name: "RBAC Integration",
      slug: "rbac-integration",
    });

    await db.insert(projectsTable).values([
      {
        id: projectA,
        name: "Project A",
        organizationId: orgId,
        slug: "project-a",
      },
      {
        id: projectB,
        name: "Project B",
        organizationId: orgId,
        slug: "project-b",
      },
    ]);

    await db.insert(ingestKeysTable).values({
      id: "ing_rbac_a",
      keyHash: "hash",
      keyPrefix: "abcdefgh",
      projectId: projectA,
    });
  });

  afterAll(async () => {
    await db.execute(sql`select 1`);
  });

  async function createSessionFixture(input: {
    orgRole: "owner" | "admin" | "member";
    projectRole?: "viewer" | "reporter" | "developer" | "admin";
    sessionId: string;
    token: string;
    userId: string;
  }) {
    await db.insert(userTable).values({
      createdAt: new Date(),
      email: `${input.userId}@example.com`,
      emailVerified: true,
      id: input.userId,
      name: input.userId,
      updatedAt: new Date(),
    });

    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: `member_${input.userId}`,
      organizationId: orgId,
      role: input.orgRole,
      userId: input.userId,
    });

    if (input.projectRole) {
      await db.insert(projectMembersTable).values({
        projectId: projectA,
        role: input.projectRole,
        userId: input.userId,
      });
    }

    await db.insert(sessionTable).values({
      activeOrganizationId: orgId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: input.sessionId,
      token: input.token,
      updatedAt: new Date(),
      userId: input.userId,
    });
  }

  async function sessionCookieHeaders(token: string): Promise<HeadersInit> {
    const { makeSignature } = await import("better-auth/crypto");
    const ctx = await auth.$context;
    const cookieName = ctx.authCookies.sessionToken.name;
    const signedToken = `${token}.${await makeSignature(token, ctx.secret)}`;
    return { cookie: `${cookieName}=${signedToken}` };
  }

  test("viewer can read project but not rotate ingest key", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "viewer",
      sessionId: "session_viewer",
      token: "token-viewer-rbac-integration",
      userId: "user_viewer",
    });

    const headers = await sessionCookieHeaders("token-viewer-rbac-integration");

    const getResponse = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}`, {
        headers,
      })
    );
    expect(getResponse.status).toBe(200);

    const rotateResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${projectA}/ingest-keys/rotate`,
        { headers, method: "POST" }
      )
    );
    expect(rotateResponse.status).toBe(403);
    const rotateBody = (await rotateResponse.json()) as {
      error: { code: string };
    };
    expect(rotateBody.error.code).toBe("FORBIDDEN");
  });

  test("reporter can read but not delete project", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "reporter",
      sessionId: "session_reporter",
      token: "token-reporter-rbac-integration",
      userId: "user_reporter",
    });

    const headers = await sessionCookieHeaders(
      "token-reporter-rbac-integration"
    );

    const getResponse = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}`, {
        headers,
      })
    );
    expect(getResponse.status).toBe(200);

    const deleteResponse = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}`, {
        headers,
        method: "DELETE",
      })
    );
    expect(deleteResponse.status).toBe(403);
  });

  test("developer cannot add project members", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "developer",
      sessionId: "session_developer",
      token: "token-developer-rbac-integration",
      userId: "user_developer",
    });

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "target@example.com",
      emailVerified: true,
      id: "user_target",
      name: "Target",
      updatedAt: new Date(),
    });
    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_target",
      organizationId: orgId,
      role: "member",
      userId: "user_target",
    });

    const headers = await sessionCookieHeaders(
      "token-developer-rbac-integration"
    );

    const response = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}/members`, {
        body: JSON.stringify({ role: "viewer", userId: "user_target" }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );
    expect(response.status).toBe(403);
  });

  test("project admin can manage members rotate and delete", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "admin",
      sessionId: "session_admin",
      token: "token-admin-rbac-integration",
      userId: "user_admin",
    });

    await db.insert(userTable).values({
      createdAt: new Date(),
      email: "member@example.com",
      emailVerified: true,
      id: "user_member",
      name: "Member",
      updatedAt: new Date(),
    });
    await db.insert(memberTable).values({
      createdAt: new Date(),
      id: "member_member",
      organizationId: orgId,
      role: "member",
      userId: "user_member",
    });

    const headers = await sessionCookieHeaders("token-admin-rbac-integration");

    const addResponse = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}/members`, {
        body: JSON.stringify({ role: "viewer", userId: "user_member" }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );
    expect(addResponse.status).toBe(201);

    const rotateResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${projectA}/ingest-keys/rotate`,
        { headers, method: "POST" }
      )
    );
    expect(rotateResponse.status).toBe(200);
  });

  test("org admin without membership can read and rotate via override", async () => {
    await createSessionFixture({
      orgRole: "admin",
      sessionId: "session_org_admin",
      token: "token-org-admin-rbac-integration",
      userId: "user_org_admin",
    });

    const headers = await sessionCookieHeaders(
      "token-org-admin-rbac-integration"
    );

    const getResponse = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}`, {
        headers,
      })
    );
    expect(getResponse.status).toBe(200);

    const rotateResponse = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${projectA}/ingest-keys/rotate`,
        { headers, method: "POST" }
      )
    );
    expect(rotateResponse.status).toBe(200);
  });

  test("org member without project membership gets forbidden on project read", async () => {
    await createSessionFixture({
      orgRole: "member",
      sessionId: "session_no_access",
      token: "token-no-access-rbac-integration",
      userId: "user_no_access",
    });

    const headers = await sessionCookieHeaders(
      "token-no-access-rbac-integration"
    );

    const getResponse = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}`, {
        headers,
      })
    );
    expect(getResponse.status).toBe(403);
  });

  test("org admin lists all projects while member lists only assigned", async () => {
    await createSessionFixture({
      orgRole: "admin",
      sessionId: "session_list_admin",
      token: "token-list-admin-rbac-integration",
      userId: "user_list_admin",
    });

    await createSessionFixture({
      orgRole: "member",
      projectRole: "viewer",
      sessionId: "session_list_member",
      token: "token-list-member-rbac-integration",
      userId: "user_list_member",
    });

    const adminHeaders = await sessionCookieHeaders(
      "token-list-admin-rbac-integration"
    );
    const memberHeaders = await sessionCookieHeaders(
      "token-list-member-rbac-integration"
    );

    const adminList = await app.handle(
      new Request(`http://localhost:3001/api/v1/workspaces/${orgId}/projects`, {
        headers: adminHeaders,
      })
    );
    const adminBody = (await adminList.json()) as { data: unknown[] };
    expect(adminBody.data).toHaveLength(2);

    const memberList = await app.handle(
      new Request(`http://localhost:3001/api/v1/workspaces/${orgId}/projects`, {
        headers: memberHeaders,
      })
    );
    const memberBody = (await memberList.json()) as {
      data: Array<{ id: string }>;
    };
    expect(memberBody.data).toHaveLength(1);
    expect(memberBody.data[0]?.id).toBe(projectA);
  });

  test("adding non-org member returns validation error", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "admin",
      sessionId: "session_add_admin",
      token: "token-add-admin-rbac-integration",
      userId: "user_add_admin",
    });

    const headers = await sessionCookieHeaders(
      "token-add-admin-rbac-integration"
    );

    const response = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}/members`, {
        body: JSON.stringify({ role: "viewer", userId: "user_outsider" }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );
    expect(response.status).toBe(422);
  });

  test("cannot remove last project admin", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "admin",
      sessionId: "session_last_admin",
      token: "token-last-admin-rbac-integration",
      userId: "user_last_admin",
    });

    const headers = await sessionCookieHeaders(
      "token-last-admin-rbac-integration"
    );

    const response = await app.handle(
      new Request(
        `http://localhost:3001/api/v1/projects/${projectA}/members/user_last_admin`,
        { headers, method: "DELETE" }
      )
    );
    expect(response.status).toBe(409);
  });

  test("org member cannot list workspace members with emails", async () => {
    await createSessionFixture({
      orgRole: "member",
      projectRole: "viewer",
      sessionId: "session_org_member_list",
      token: "token-org-member-list-rbac-integration",
      userId: "user_org_member_list",
    });

    const headers = await sessionCookieHeaders(
      "token-org-member-list-rbac-integration"
    );

    const response = await app.handle(
      new Request(`http://localhost:3001/api/v1/workspaces/${orgId}/members`, {
        headers,
      })
    );
    expect(response.status).toBe(403);
  });

  test("org admin can list workspace members", async () => {
    await createSessionFixture({
      orgRole: "admin",
      sessionId: "session_org_admin_list",
      token: "token-org-admin-list-rbac-integration",
      userId: "user_org_admin_list",
    });

    const headers = await sessionCookieHeaders(
      "token-org-admin-list-rbac-integration"
    );

    const response = await app.handle(
      new Request(`http://localhost:3001/api/v1/workspaces/${orgId}/members`, {
        headers,
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ email: string; userId: string }>;
    };
    expect(body.data.some((row) => row.userId === "user_org_admin_list")).toBe(
      true
    );
  });

  test("cross-org workspace member list returns not found", async () => {
    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_other_members",
      name: "Other Org Members",
      slug: "other-org-members",
    });

    await createSessionFixture({
      orgRole: "admin",
      sessionId: "session_cross_org_members",
      token: "token-cross-org-members-rbac-integration",
      userId: "user_cross_org_members",
    });

    const headers = await sessionCookieHeaders(
      "token-cross-org-members-rbac-integration"
    );

    const response = await app.handle(
      new Request(
        "http://localhost:3001/api/v1/workspaces/org_other_members/members",
        { headers }
      )
    );
    expect(response.status).toBe(403);
  });

  test("cross-org project member list returns not found", async () => {
    await db.insert(organizationTable).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_other",
      name: "Other Org",
      slug: "other-org",
    });

    await createSessionFixture({
      orgRole: "member",
      projectRole: "admin",
      sessionId: "session_cross_org",
      token: "token-cross-org-rbac-integration",
      userId: "user_cross_org",
    });

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: "org_other" })
      .where(eq(sessionTable.id, "session_cross_org"));

    const headers = await sessionCookieHeaders(
      "token-cross-org-rbac-integration"
    );

    const response = await app.handle(
      new Request(`http://localhost:3001/api/v1/projects/${projectA}/members`, {
        headers,
      })
    );
    expect([403, 404]).toContain(response.status);
  });
});
