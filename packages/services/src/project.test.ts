import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import { ingestKeys, organization, projects } from "@usebugreport/db";
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
  });

  test("creates project with hashed ingest key and returns plaintext once", async () => {
    const projectService = createProjectService(db);
    const ctx = { organizationId: orgId, type: "session" as const, userId };

    const { ingestKeyPlaintext, project } = await projectService.createProject(
      ctx,
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

    const validated =
      await projectService.validateIngestKey(ingestKeyPlaintext);
    expect(validated).toEqual({
      organizationId: orgId,
      projectId: project.id,
    });
  });

  test("rotation revokes prior key immediately", async () => {
    const projectService = createProjectService(db);
    const ctx = { organizationId: orgId, type: "session" as const, userId };

    const created = await projectService.createProject(ctx, {
      name: "Rotate Me",
    });
    const createdProject = created.project;
    const oldKey = created.ingestKeyPlaintext;

    const rotated = await projectService.rotateIngestKey(
      ctx,
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
    const created = await projectService.createProject(
      { organizationId: orgId, type: "session", userId },
      { name: "Scoped" }
    );

    await expect(
      projectService.getProject(
        { organizationId: "org_other", type: "session", userId },
        created.project.id
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("listProjects scopes to organization", async () => {
    const projectService = createProjectService(db);
    await projectService.createProject(
      { organizationId: orgId, type: "session", userId },
      { name: "One" }
    );

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

    const listed = await projectService.listProjects({
      organizationId: orgId,
      type: "session",
      userId,
    });

    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]?.organizationId).toBe(orgId);
  });
});
