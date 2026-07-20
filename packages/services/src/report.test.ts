import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  member,
  organization,
  reportBlobs,
  reports,
  user,
} from "@usebugreport/db";
import { eq, sql } from "drizzle-orm";
import { buildIngestR2Key, createCaptureIngestService } from "./ingest";
import { createProjectService } from "./project";
import { createReportService } from "./report";
import { createUsageService } from "./usage";

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

function gzipJson(value: unknown): Uint8Array {
  const { gzipSync } = require("node:zlib") as typeof import("node:zlib");
  return gzipSync(Buffer.from(JSON.stringify(value)));
}

runDbTests("ReportService", () => {
  let db: DbClient;
  const orgId = "org_report_read_test";
  const userId = "user_report_read_test";
  let projectId = "";
  let reportId = "";

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
      name: "Report Org",
      slug: "report-org",
    });

    await db.insert(user).values({
      createdAt: new Date(),
      email: "report@example.com",
      emailVerified: true,
      id: userId,
      name: "Report User",
      updatedAt: new Date(),
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_report_read_test",
      organizationId: orgId,
      role: "owner",
      userId,
    });

    const projectService = createProjectService(db);
    const created = await projectService.createProject(
      { organizationId: orgId, type: "session", userId },
      { name: "Reports" }
    );
    projectId = created.project.id;
    reportId = "rpt_report_read_test";

    const metaKey = buildIngestR2Key(orgId, projectId, reportId, {
      contentType: "application/json",
      name: "meta",
    });
    const consoleKey = buildIngestR2Key(orgId, projectId, reportId, {
      contentType: "application/gzip",
      name: "console",
    });
    const replayKey = buildIngestR2Key(orgId, projectId, reportId, {
      contentType: "application/gzip",
      name: "replay",
      seq: 0,
    });

    const objects = new Map<string, Uint8Array>([
      [
        metaKey,
        new TextEncoder().encode(
          JSON.stringify({
            browser: { name: "Chrome" },
            url: "https://app.test",
          })
        ),
      ],
      [consoleKey, gzipJson([{ level: "log", message: "hello" }])],
      [replayKey, gzipJson([{ data: {}, type: 2 }])],
    ]);

    const ingest = createCaptureIngestService(db, {
      enqueueFinalize: () => Promise.resolve(),
      r2: {
        getObject: (key) => {
          const value = objects.get(key);
          if (!value) {
            return Promise.reject(new Error(`missing object ${key}`));
          }
          return Promise.resolve(value);
        },
        headObject: (key) =>
          Promise.resolve({
            contentLength: objects.get(key)?.byteLength ?? 0,
            contentType: key.endsWith(".json")
              ? "application/json"
              : "application/gzip",
          }),
        presignPut: (key) => Promise.resolve(`https://put.test/${key}`),
        putObject: () => Promise.resolve(),
      },
      usageService: createUsageService(db),
    });

    await db.insert(reports).values({
      description: "Details",
      id: reportId,
      ingestStatus: "processing",
      organizationId: orgId,
      projectId,
      status: "open",
      title: "Broken checkout",
    });

    await ingest.processFinalizeJob({
      idempotencyKey: "idem-finalize-report",
      projectId,
      r2Keys: [metaKey, consoleKey, replayKey],
      reportId,
    });
  });

  function sessionCtx() {
    return {
      organizationId: orgId,
      orgRole: "owner" as const,
      type: "session" as const,
      userId,
    };
  }

  test("getById scopes to organization and project access", async () => {
    const r2 = {
      getObject: (_key: string) => Promise.resolve(new Uint8Array()),
      presignGet: (key: string) => Promise.resolve(`https://get.test/${key}`),
    };
    const reportService = createReportService(db, { r2 });

    const report = await reportService.getById(sessionCtx(), reportId);
    expect(report.title).toBe("Broken checkout");
    expect(report.ingestStatus).toBe("complete");

    await expect(
      reportService.getById(
        { ...sessionCtx(), organizationId: "org_other" },
        reportId
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("getConsoleLogs decompresses console.json.gz from R2", async () => {
    const consoleKey = buildIngestR2Key(orgId, projectId, reportId, {
      contentType: "application/gzip",
      name: "console",
    });
    const payload = gzipJson([{ level: "error", message: "boom" }]);

    const r2 = {
      getObject: (key: string) =>
        Promise.resolve(key === consoleKey ? payload : new Uint8Array()),
      presignGet: (key: string) => Promise.resolve(`https://get.test/${key}`),
    };
    const reportService = createReportService(db, { r2 });

    const logs = await reportService.getConsoleLogs(sessionCtx(), reportId);
    expect(logs).toEqual([{ level: "error", message: "boom" }]);
  });

  test("getReplayManifest returns presigned replay batches", async () => {
    const presigned: string[] = [];
    const r2 = {
      getObject: () => Promise.resolve(new Uint8Array()),
      presignGet: (key: string) => {
        const url = `https://get.test/${encodeURIComponent(key)}?ttl=900`;
        presigned.push(url);
        return Promise.resolve(url);
      },
    };
    const reportService = createReportService(db, { r2 });

    const manifest = await reportService.getReplayManifest(
      sessionCtx(),
      reportId
    );

    expect(manifest.batches).toHaveLength(1);
    expect(manifest.batches[0]?.url).toContain("replay");
    expect(presigned.length).toBeGreaterThan(0);

    const blobTypes = await db
      .select({ type: reportBlobs.type })
      .from(reportBlobs)
      .where(eq(reportBlobs.reportId, reportId));
    expect(blobTypes.map((row) => row.type)).toContain("replay");
  });
});
