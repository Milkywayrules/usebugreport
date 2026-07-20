import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  organization,
  projects,
  reportBlobs,
  reports,
} from "@usebugreport/db";
import type { R2Client, R2ListedObject } from "@usebugreport/storage";
import { eq, sql } from "drizzle-orm";
import { createRetentionService } from "./retention";

function mockR2(initial: Record<string, R2ListedObject[]> = {}): R2Client {
  const store = new Map<string, R2ListedObject>();
  for (const [prefix, objects] of Object.entries(initial)) {
    for (const object of objects) {
      store.set(object.key, object);
    }
    void prefix;
  }

  return {
    bucket: "test",
    client: {} as R2Client["client"],
    deleteObject: async (key) => {
      store.delete(key);
    },
    getObject: async () => new Uint8Array(),
    headObject: async () => ({ contentLength: 0, contentType: "application/json" }),
    listObjects: async (prefix) =>
      [...store.values()].filter((object) => object.key.startsWith(prefix)),
    presignGet: async () => "https://example.com/get",
    presignPut: async () => "https://example.com/put",
    putObject: async (key) => {
      store.set(key, { key, lastModified: new Date() });
    },
  };
}

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

runDbTests("RetentionService integration", () => {
  let db: DbClient;
  const orgId = "org_retention_test";
  const projectId = "prj_retention_test";

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
        report_blobs,
        reports,
        projects,
        organization
      restart identity cascade
    `);

    await db.insert(organization).values({
      billingTier: "free",
      createdAt: new Date(),
      id: orgId,
      name: "Retention Org",
      slug: "retention-org",
    });

    await db.insert(projects).values({
      createdAt: new Date(),
      id: projectId,
      name: "App",
      organizationId: orgId,
      slug: "app",
    });
  });

  test("removes expired blobs and deletes R2 keys", async () => {
    const reportId = "rpt_expired_blob";
    const r2Key = `${orgId}/${projectId}/${reportId}/replay/batch-0.json.gz`;
    const deleted: string[] = [];
    const r2 = mockR2({ [orgId]: [{ key: r2Key, lastModified: new Date() }] });
    r2.deleteObject = async (key) => {
      deleted.push(key);
    };

    await db.insert(reports).values({
      createdAt: new Date(),
      environment: {},
      id: reportId,
      ingestStatus: "complete",
      organizationId: orgId,
      projectId,
      status: "open",
      title: "Expired blob report",
    });

    await db.insert(reportBlobs).values({
      contentType: "application/gzip",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() - 60_000),
      id: "blob_expired",
      r2Key,
      reportId,
      seq: 0,
      sizeBytes: 10,
      type: "replay",
    });

    const service = createRetentionService(db, {
      getRetentionDays: async () => ({
        metadataDays: 30,
        replayDays: 7,
        screenshotDays: 7,
      }),
      r2,
    });

    const stats = await service.runSweep(orgId);
    expect(stats.expiredBlobsRemoved).toBe(1);
    expect(deleted).toEqual([r2Key]);

    const remaining = await db
      .select()
      .from(reportBlobs)
      .where(eq(reportBlobs.reportId, reportId));
    expect(remaining).toHaveLength(0);
  });

  test("deletes stale pending reports older than 24h", async () => {
    const reportId = "rpt_stale_pending";
    const r2Key = `${orgId}/${projectId}/${reportId}/meta.json`;
    const deleted: string[] = [];
    const r2 = mockR2({ [orgId]: [{ key: r2Key, lastModified: new Date(Date.now() - 48 * 86_400_000) }] });
    r2.deleteObject = async (key) => {
      deleted.push(key);
    };

    await db.insert(reports).values({
      createdAt: new Date(Date.now() - 48 * 86_400_000),
      environment: {},
      id: reportId,
      ingestStatus: "pending",
      organizationId: orgId,
      projectId,
      status: "open",
      title: "Stale pending",
    });

    const service = createRetentionService(db, {
      getRetentionDays: async () => ({
        metadataDays: 30,
        replayDays: 7,
        screenshotDays: 7,
      }),
      r2,
    });

    const stats = await service.runSweep(orgId);
    expect(stats.stalePendingReportsRemoved).toBe(1);
    expect(deleted).toContain(r2Key);

    const remaining = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId));
    expect(remaining).toHaveLength(0);
  });
});
