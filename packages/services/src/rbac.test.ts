import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  member,
  organization,
  projectMembers,
  projects,
  user,
} from "@usebugreport/db";
import { sql } from "drizzle-orm";
import { createRBACService } from "./rbac";
import type { AuthContext, ProjectAction, ProjectRole } from "./types";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

const ACTIONS: ProjectAction[] = [
  "project:read",
  "ingest:submit",
  "integration:manage",
  "linear:push",
  "report:delete",
  "project:manage_members",
  "ingest:rotate",
  "project:delete",
  "project:update",
];

const ROLES: ProjectRole[] = ["viewer", "reporter", "developer", "admin"];

const MEMBERSHIP_MATRIX: Record<ProjectRole, Record<ProjectAction, boolean>> = {
  admin: {
    "ingest:rotate": true,
    "ingest:submit": true,
    "integration:manage": true,
    "linear:push": true,
    "project:delete": true,
    "project:manage_members": true,
    "project:read": true,
    "project:update": true,
    "report:comment": true,
    "report:delete": true,
  },
  developer: {
    "ingest:rotate": false,
    "ingest:submit": true,
    "integration:manage": true,
    "linear:push": true,
    "project:delete": false,
    "project:manage_members": false,
    "project:read": true,
    "project:update": false,
    "report:comment": true,
    "report:delete": false,
  },
  reporter: {
    "ingest:rotate": false,
    "ingest:submit": true,
    "integration:manage": false,
    "linear:push": false,
    "project:delete": false,
    "project:manage_members": false,
    "project:read": true,
    "project:update": false,
    "report:comment": true,
    "report:delete": false,
  },
  viewer: {
    "ingest:rotate": false,
    "ingest:submit": false,
    "integration:manage": false,
    "linear:push": false,
    "project:delete": false,
    "project:manage_members": false,
    "project:read": true,
    "project:update": false,
    "report:comment": false,
    "report:delete": false,
  },
};

runDbTests("RBACService", () => {
  let db: DbClient;
  const orgId = "org_rbac_test";
  const projectId = "prj_rbac_test";

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    const mod = await import("@usebugreport/db");
    db = mod.createDbClient(databaseUrl);
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

    await db.insert(organization).values({
      billingTier: "free",
      createdAt: new Date(),
      id: orgId,
      name: "RBAC Org",
      slug: "rbac-org",
    });

    await db.insert(projects).values({
      id: projectId,
      name: "RBAC Project",
      organizationId: orgId,
      slug: "rbac-project",
    });
  });

  async function seedUser(
    userId: string,
    orgRole: "owner" | "admin" | "member" = "member",
    projectRole?: ProjectRole
  ): Promise<AuthContext> {
    await db.insert(user).values({
      createdAt: new Date(),
      email: `${userId}@example.com`,
      emailVerified: true,
      id: userId,
      name: userId,
      updatedAt: new Date(),
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: `member_${userId}`,
      organizationId: orgId,
      role: orgRole,
      userId,
    });

    if (projectRole) {
      await db.insert(projectMembers).values({
        projectId,
        role: projectRole,
        userId,
      });
    }

    return {
      organizationId: orgId,
      orgRole,
      projectIds: projectRole ? [projectId] : [],
      type: "session",
      userId,
    };
  }

  for (const role of ROLES) {
    test(`role matrix for ${role}`, async () => {
      const rbac = createRBACService(db);
      const ctx = await seedUser(`user_${role}`, "member", role);

      const results = await Promise.all(
        ACTIONS.map((action) => rbac.canPerform(ctx, projectId, action))
      );

      for (const [index, action] of ACTIONS.entries()) {
        expect(results[index]).toBe(MEMBERSHIP_MATRIX[role][action]);
      }
    });
  }

  test("org owner without project row gets read bypass only", async () => {
    const rbac = createRBACService(db);
    const ctx = await seedUser("user_org_owner", "owner");

    const resolved = await rbac.resolveProjectRole(ctx, projectId);
    expect(resolved).toEqual({ role: "viewer", source: "org_bypass_read" });

    expect(await rbac.canPerform(ctx, projectId, "project:read")).toBe(true);
    expect(await rbac.canPerform(ctx, projectId, "ingest:submit")).toBe(false);
    expect(await rbac.canPerform(ctx, projectId, "ingest:rotate")).toBe(true);
    expect(await rbac.canPerform(ctx, projectId, "project:delete")).toBe(true);
  });

  test("org admin without project row gets admin override on administration actions", async () => {
    const rbac = createRBACService(db);
    const ctx = await seedUser("user_org_admin", "admin");

    expect(
      await rbac.canPerform(ctx, projectId, "project:manage_members")
    ).toBe(true);
    expect(await rbac.canPerform(ctx, projectId, "report:delete")).toBe(false);
    expect(await rbac.listAccessibleProjectIds(ctx)).toBe("all");
  });

  test("org member without project row has no project access", async () => {
    const rbac = createRBACService(db);
    const ctx = await seedUser("user_no_project", "member");

    const resolved = await rbac.resolveProjectRole(ctx, projectId);
    expect(resolved).toEqual({ role: null, source: "none" });

    expect(await rbac.canPerform(ctx, projectId, "project:read")).toBe(false);
    await expect(
      rbac.requireProjectRole(ctx, projectId, "viewer")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("requireProjectRole enforces hierarchy", async () => {
    const rbac = createRBACService(db);
    const ctx = await seedUser("user_reporter", "member", "reporter");

    await expect(
      rbac.requireProjectRole(ctx, projectId, "developer")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      rbac.requireProjectRole(ctx, projectId, "reporter")
    ).resolves.toBe("reporter");
  });
});
