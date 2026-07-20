import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import { member, organization, reports, user } from "@usebugreport/db";
import { sql } from "drizzle-orm";
import { createProjectService } from "./project";
import { createSearchService } from "./search";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

runDbTests("SearchService", () => {
  let db: DbClient;
  const orgId = "org_search_test";
  const userId = "user_search_test";
  let projectId = "";

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
      name: "Search Org",
      slug: "search-org",
    });

    await db.insert(user).values({
      createdAt: new Date(),
      email: "search@example.com",
      emailVerified: true,
      id: userId,
      name: "Search User",
      updatedAt: new Date(),
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_search_test",
      organizationId: orgId,
      role: "owner",
      userId,
    });

    const projectService = createProjectService(db);
    const created = await projectService.createProject(
      { organizationId: orgId, type: "session", userId },
      { name: "Search Project" }
    );
    projectId = created.project.id;

    await db.insert(reports).values([
      {
        description: "Payment fails on submit",
        id: "rpt_search_a",
        ingestStatus: "complete",
        organizationId: orgId,
        projectId,
        status: "open",
        summaryText: "checkout error stripe",
        title: "Checkout broken",
      },
      {
        description: "Unrelated",
        id: "rpt_search_b",
        ingestStatus: "complete",
        organizationId: orgId,
        projectId,
        status: "open",
        summaryText: "dashboard widget",
        title: "Dashboard layout",
      },
    ]);
  });

  function sessionCtx() {
    return {
      organizationId: orgId,
      orgRole: "owner" as const,
      type: "session" as const,
      userId,
    };
  }

  test("searchReports matches FTS query within organization", async () => {
    const searchService = createSearchService(db);
    const result = await searchService.searchReports(sessionCtx(), {
      query: "checkout",
    });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.id).toBe("rpt_search_a");
    expect(result.data[0]?.title).toBe("Checkout broken");
  });
});
