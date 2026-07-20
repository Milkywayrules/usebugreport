import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import { member, organization, user, userPreferences } from "@usebugreport/db";
import { eq, sql } from "drizzle-orm";
import { createUsageService } from "./usage";
import { createWorkspaceService } from "./workspace";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

function createMockAuthApi(sessionId = "session_workspace_test") {
  return {
    getSession: () => Promise.resolve({ session: { id: sessionId } }),
  };
}

runDbTests("WorkspaceService", () => {
  let db: DbClient;

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

  test("rejects workspace create when tier limit exceeded", async () => {
    const userId = "user_ws_tier";
    await db.insert(user).values({
      createdAt: new Date(),
      email: "tier@example.com",
      emailVerified: true,
      id: userId,
      name: "Tier User",
      updatedAt: new Date(),
    });

    await db.insert(organization).values({
      billingTier: "free",
      createdAt: new Date(),
      id: "org_existing",
      name: "Existing",
      slug: "existing",
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_existing",
      organizationId: "org_existing",
      role: "owner",
      userId,
    });

    const usageService = createUsageService(db);
    const workspaceService = createWorkspaceService(db, {
      authApi: createMockAuthApi(),
      usageService,
    });

    await expect(
      workspaceService.createWorkspace(
        { organizationId: "", type: "session", userId },
        { name: "Second Workspace" },
        new Headers()
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("creates workspace when under tier limit", async () => {
    const userId = "user_ws_ok";
    await db.insert(user).values({
      createdAt: new Date(),
      email: "ok@example.com",
      emailVerified: true,
      id: userId,
      name: "OK User",
      updatedAt: new Date(),
    });

    const usageService = createUsageService(db);
    const workspaceService = createWorkspaceService(db, {
      authApi: createMockAuthApi(),
      usageService,
    });

    const org = await workspaceService.createWorkspace(
      { organizationId: "", type: "session", userId },
      { name: "First Workspace" },
      new Headers()
    );

    expect(org.slug).toBe("first-workspace");

    const memberRow = await db.query.member.findFirst({
      where: eq(member.userId, userId),
    });
    expect(memberRow?.role).toBe("owner");
  });

  test("updates pinned workspace preferences with max 9 validation", async () => {
    const userId = "user_pins";
    await db.insert(user).values({
      createdAt: new Date(),
      email: "pins@example.com",
      emailVerified: true,
      id: userId,
      name: "Pin User",
      updatedAt: new Date(),
    });

    const orgIds = Array.from({ length: 10 }, (_, index) => `org_pin_${index}`);
    await Promise.all(
      orgIds.map(async (orgId, index) => {
        await db.insert(organization).values({
          billingTier: "free",
          createdAt: new Date(),
          id: orgId,
          name: `Org ${index}`,
          slug: `org-${index}`,
        });
        await db.insert(member).values({
          createdAt: new Date(),
          id: `member_${orgId}`,
          organizationId: orgId,
          role: "owner",
          userId,
        });
      })
    );

    const workspaceService = createWorkspaceService(db, {
      authApi: createMockAuthApi(),
      usageService: createUsageService(db),
    });

    await expect(
      workspaceService.updatePinnedPreferences(
        { organizationId: "", type: "session", userId },
        { pinnedWorkspaceIds: orgIds }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const prefs = await workspaceService.updatePinnedPreferences(
      { organizationId: "", type: "session", userId },
      { pinnedWorkspaceIds: orgIds.slice(0, 9) }
    );

    expect(prefs.pinnedWorkspaceIds).toHaveLength(9);

    const row = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });
    expect(row?.pinnedWorkspaceIds).toHaveLength(9);
  });
});
