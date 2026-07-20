import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  ingestKeys,
  member,
  organization,
  projectMembers,
  projects,
  user,
} from "@usebugreport/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { createProjectService } from "./project";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

runDbTests("ProjectService", () => {
  let db: DbClient;
  const orgId = "org_project_test";
  const userId = "user_project_test";

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
      name: "Project Org",
      slug: "project-org",
    });

    await db.insert(user).values({
      createdAt: new Date(),
      email: "owner@example.com",
      emailVerified: true,
      id: userId,
      name: "Owner",
      updatedAt: new Date(),
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_project_test",
      organizationId: orgId,
      role: "owner",
      userId,
    });
  });

  function ctx(orgRole: "owner" | "admin" | "member" = "owner") {
    return {
      organizationId: orgId,
      orgRole,
      projectIds: [] as string[],
      type: "session" as const,
      userId,
    };
  }

  test("creates project with hashed ingest key and returns plaintext once", async () => {
    const projectService = createProjectService(db);

    const { ingestKeyPlaintext, project } = await projectService.createProject(
      ctx(),
      {
        name: "Web App",
      }
    );

    expect(project.id.startsWith("prj_")).toBe(true);
    expect(ingestKeyPlaintext.startsWith("ubr_ingest_")).toBe(true);
    expect(ingestKeyPlaintext.slice(-8)).toHaveLength(8);

    const rows = await db.select().from(ingestKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.keyHash).not.toBe(ingestKeyPlaintext);

    const memberRows = await db.select().from(projectMembers);
    expect(memberRows).toEqual([
      expect.objectContaining({
        projectId: project.id,
        role: "admin",
        userId,
      }),
    ]);

    const validated =
      await projectService.validateIngestKey(ingestKeyPlaintext);
    expect(validated).toEqual({
      organizationId: orgId,
      projectId: project.id,
    });
  });

  test("rotation revokes prior key immediately", async () => {
    const projectService = createProjectService(db);

    const created = await projectService.createProject(ctx(), {
      name: "Rotate Me",
    });
    const createdProject = created.project;
    const oldKey = created.ingestKeyPlaintext;

    const rotated = await projectService.rotateIngestKey(
      ctx(),
      createdProject.id
    );
    expect(rotated.ingestKeyPlaintext).not.toBe(oldKey);

    expect(await projectService.validateIngestKey(oldKey)).toBeNull();
    expect(
      await projectService.validateIngestKey(rotated.ingestKeyPlaintext)
    ).toEqual({
      organizationId: orgId,
      projectId: createdProject.id,
    });

    const active = await db
      .select()
      .from(ingestKeys)
      .where(
        and(
          eq(ingestKeys.projectId, createdProject.id),
          isNull(ingestKeys.revokedAt)
        )
      );
    expect(active).toHaveLength(1);
  });

  test("rejects cross-tenant project access", async () => {
    const projectService = createProjectService(db);
    const created = await projectService.createProject(ctx(), {
      name: "Scoped",
    });

    await expect(
      projectService.getProject(
        { organizationId: "org_other", type: "session", userId },
        created.project.id
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("listProjects scopes to accessible projects for org members", async () => {
    const projectService = createProjectService(db);
    const created = await projectService.createProject(ctx(), { name: "One" });

    await db.insert(organization).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_other",
      name: "Other",
      slug: "other",
    });

    await db.insert(projects).values({
      id: "prj_other",
      name: "Other Project",
      organizationId: "org_other",
      slug: "other-project",
    });

    const listed = await projectService.listProjects(ctx("member"));

    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]?.id).toBe(created.project.id);
  });

  test("member CRUD enforces admin role and org membership", async () => {
    const projectService = createProjectService(db);
    const created = await projectService.createProject(ctx(), { name: "Team" });

    await db.insert(user).values({
      createdAt: new Date(),
      email: "teammate@example.com",
      emailVerified: true,
      id: "user_teammate",
      name: "Teammate",
      updatedAt: new Date(),
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_teammate",
      organizationId: orgId,
      role: "member",
      userId: "user_teammate",
    });

    const adminCtx = ctx();
    const added = await projectService.addProjectMember(
      adminCtx,
      created.project.id,
      { role: "viewer", userId: "user_teammate" }
    );
    expect(added.role).toBe("viewer");

    const members = await projectService.listProjectMembers(
      adminCtx,
      created.project.id
    );
    expect(members).toHaveLength(2);

    await expect(
      projectService.addProjectMember(adminCtx, created.project.id, {
        role: "viewer",
        userId: "user_outsider",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
