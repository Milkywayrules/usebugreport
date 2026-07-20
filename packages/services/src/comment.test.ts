import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  member,
  organization,
  projectMembers,
  projects,
  reportComments,
  reports,
  user,
} from "@usebugreport/db";
import { eq, sql } from "drizzle-orm";
import { createCommentService } from "./comment";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

runDbTests("CommentService", () => {
  let db: DbClient;
  const orgId = "org_comment_test";
  const reporterId = "user_comment_reporter";
  const viewerId = "user_comment_viewer";
  let projectId = "prj_comment_test";
  let reportId = "rpt_comment_test";

  beforeAll(async () => {
    const mod = await import("@usebugreport/db");
    db = mod.createDbClient(databaseUrl!);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table
        report_comments,
        project_members,
        ingest_keys,
        projects,
        reports,
        report_blobs,
        workspace_usage_monthly,
        member,
        organization,
        session,
        "user"
      restart identity cascade
    `);

    await db.insert(organization).values({
      billingTier: "pro",
      createdAt: new Date(),
      id: orgId,
      name: "Comment Org",
      slug: "comment-org",
    });

    for (const row of [
      { id: reporterId, name: "Reporter", email: "rep@example.com" },
      { id: viewerId, name: "Viewer", email: "view@example.com" },
    ]) {
      await db.insert(user).values({
        createdAt: new Date(),
        email: row.email,
        emailVerified: true,
        id: row.id,
        name: row.name,
        updatedAt: new Date(),
      });
      await db.insert(member).values({
        createdAt: new Date(),
        id: `member_${row.id}`,
        organizationId: orgId,
        role: "member",
        userId: row.id,
      });
    }

    await db.insert(projects).values({
      id: projectId,
      name: "App",
      organizationId: orgId,
      slug: "app",
    });

    await db.insert(projectMembers).values([
      { projectId, role: "reporter", userId: reporterId },
      { projectId, role: "viewer", userId: viewerId },
    ]);

    await db.insert(reports).values({
      createdAt: new Date(),
      description: null,
      environment: {},
      id: reportId,
      ingestStatus: "complete",
      organizationId: orgId,
      projectId,
      status: "open",
      summary: {},
      summaryText: null,
      title: "Comment target",
      updatedAt: new Date(),
    });
  });

  test("reporter creates and lists comments", async () => {
    const service = createCommentService(db);
    const ctx = {
      organizationId: orgId,
      requestId: "req_test",
      type: "session" as const,
      userId: reporterId,
    };

    const created = await service.create(ctx, reportId, {
      body: "  triage note  ",
    });
    expect(created.body).toBe("triage note");
    expect(created.id.startsWith("cmt_")).toBe(true);

    const thread = await service.list(ctx, reportId);
    expect(thread.canComment).toBe(true);
    expect(thread.comments).toHaveLength(1);
  });

  test("viewer can list but not comment", async () => {
    const service = createCommentService(db);
    const ctx = {
      organizationId: orgId,
      requestId: "req_viewer",
      type: "session" as const,
      userId: viewerId,
    };

    const thread = await service.list(ctx, reportId);
    expect(thread.canComment).toBe(false);

    await expect(
      service.create(ctx, reportId, { body: "blocked" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
