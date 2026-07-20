import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "@usebugreport/db";
import {
  member,
  organization,
  reportBlobs,
  reports,
  user,
  workspaceUsageMonthly,
} from "@usebugreport/db";
import type { IngestFinalizePayload } from "@usebugreport/queue";
import { eq, sql } from "drizzle-orm";
import { buildIngestR2Key, createCaptureIngestService } from "./ingest";
import { createProjectService } from "./project";
import { createUsageService } from "./usage";

function contentTypeForTestKey(key: string): string {
  if (key.endsWith(".webp")) {
    return "image/webp";
  }
  if (key.endsWith("/meta.json")) {
    return "application/json";
  }
  return "application/gzip";
}

describe("buildIngestR2Key", () => {
  test("builds layout per architecture section 7", () => {
    expect(
      buildIngestR2Key("org_a", "prj_b", "rpt_c", {
        contentType: "application/gzip",
        name: "replay",
        seq: 2,
      })
    ).toBe("org_a/prj_b/rpt_c/replay/batch-2.json.gz");

    expect(
      buildIngestR2Key("org_a", "prj_b", "rpt_c", {
        contentType: "application/json",
        name: "meta",
      })
    ).toBe("org_a/prj_b/rpt_c/meta.json");
  });
});

const databaseUrl = process.env.DATABASE_URL;
const runDbTests = databaseUrl ? describe : describe.skip;

runDbTests("CaptureIngestService", () => {
  let db: DbClient;
  const orgId = "org_ingest_test";
  const userId = "user_ingest_test";
  let projectId = "";
  let ingestKeyPlaintext = "";

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
      name: "Ingest Org",
      slug: "ingest-org",
    });

    await db.insert(user).values({
      createdAt: new Date(),
      email: "ingest@example.com",
      emailVerified: true,
      id: userId,
      name: "Ingest User",
      updatedAt: new Date(),
    });

    await db.insert(member).values({
      createdAt: new Date(),
      id: "member_ingest_test",
      organizationId: orgId,
      role: "owner",
      userId,
    });

    const projectService = createProjectService(db);
    const created = await projectService.createProject(
      { organizationId: orgId, type: "session", userId },
      { name: "Capture" }
    );
    ({
      ingestKeyPlaintext,
      project: { id: projectId },
    } = created);
  });

  function createService(options?: {
    enqueueFinalize?: (payload: IngestFinalizePayload) => Promise<void>;
    generateId?: () => string;
    putObject?: (
      key: string,
      body: Uint8Array,
      contentType: string
    ) => Promise<void>;
  }) {
    const enqueued: IngestFinalizePayload[] = [];
    const putCalls: Array<{
      contentType: string;
      key: string;
      size: number;
    }> = [];
    const service = createCaptureIngestService(db, {
      enqueueFinalize:
        options?.enqueueFinalize ??
        ((payload) => {
          enqueued.push(payload);
          return Promise.resolve();
        }),
      generateId: options?.generateId,
      r2: {
        getObject: (key) => {
          if (key.endsWith("/meta.json")) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({
                  browser: { name: "Chrome", version: "120" },
                  os: { name: "Linux" },
                  url: "https://app.test/page",
                  userAgent: "test-agent",
                })
              )
            );
          }
          return Promise.resolve(new Uint8Array([1, 2, 3]));
        },
        headObject: (key) =>
          Promise.resolve({
            contentLength: key.endsWith("/meta.json") ? 64 : 3,
            contentType: contentTypeForTestKey(key),
          }),
        presignPut: (key, contentType) =>
          Promise.resolve(
            `https://r2.test/${encodeURIComponent(key)}?contentType=${encodeURIComponent(contentType)}`
          ),
        putObject:
          options?.putObject ??
          ((key, body, contentType) => {
            putCalls.push({
              contentType,
              key,
              size: body.byteLength,
            });
            return Promise.resolve();
          }),
      },
      usageService: createUsageService(db),
    });

    return { enqueued, putCalls, service };
  }

  test("presign upserts report and returns presigned uploads", async () => {
    const { service } = createService();
    const result = await service.presignUpload(
      {
        idempotencyKey: "idem-presign-1",
        organizationId: orgId,
        projectId,
        requestId: "req_test",
      },
      {
        parts: [
          { contentType: "application/gzip", name: "replay", seq: 0 },
          { contentType: "application/json", name: "meta" },
        ],
        title: "First report",
      }
    );

    expect(result.reportId.startsWith("rpt_")).toBe(true);
    expect(result.uploads).toHaveLength(2);
    expect(result.uploads[0]?.key).toBe(
      `${orgId}/${projectId}/${result.reportId}/replay/batch-0.json.gz`
    );

    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, result.reportId));
    expect(report?.ingestStatus).toBe("pending");
    expect(report?.title).toBe("First report");
    expect(ingestKeyPlaintext.startsWith("ubr_ingest_")).toBe(true);
  });

  test("presign idempotency returns same reportId", async () => {
    const { service } = createService({ generateId: () => "rpt_fixed_id" });
    const ctx = {
      idempotencyKey: "idem-presign-2",
      organizationId: orgId,
      projectId,
      requestId: "req_test",
    };

    const first = await service.presignUpload(ctx, {
      parts: [{ contentType: "application/json", name: "meta" }],
    });
    const second = await service.presignUpload(ctx, {
      parts: [{ contentType: "application/json", name: "meta" }],
    });

    expect(second.reportId).toBe(first.reportId);
  });

  test("complete enqueues refs-only finalize payload", async () => {
    const { enqueued, service } = createService();
    const presign = await service.presignUpload(
      {
        idempotencyKey: "idem-complete-1",
        organizationId: orgId,
        projectId,
        requestId: "req_test",
      },
      {
        parts: [{ contentType: "application/json", name: "meta" }],
      }
    );

    const r2Key = `${orgId}/${projectId}/${presign.reportId}/meta.json`;
    const complete = await service.completeIngest(
      {
        idempotencyKey: "idem-complete-1",
        organizationId: orgId,
        projectId,
        requestId: "req_test",
      },
      { r2Keys: [r2Key], reportId: presign.reportId }
    );

    expect(complete.status).toBe("processing");
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toEqual({
      idempotencyKey: "idem-complete-1",
      projectId,
      r2Keys: [r2Key],
      reportId: presign.reportId,
    });

    const [report] = await db
      .select({ ingestStatus: reports.ingestStatus })
      .from(reports)
      .where(eq(reports.id, presign.reportId));
    expect(report?.ingestStatus).toBe("processing");
  });

  test("inline ingest uploads parts before enqueue", async () => {
    const { enqueued, putCalls, service } = createService();
    const ctx = {
      idempotencyKey: "idem-inline-1",
      organizationId: orgId,
      projectId,
      requestId: "req_test",
    };
    const parts = [
      {
        body: new Uint8Array([1, 2, 3]),
        contentType: "application/gzip",
        name: "replay" as const,
        seq: 0,
      },
      {
        body: new Uint8Array([4]),
        contentType: "application/gzip",
        name: "console" as const,
      },
      {
        body: new Uint8Array([5]),
        contentType: "application/gzip",
        name: "network" as const,
      },
      {
        body: new Uint8Array([6]),
        contentType: "application/json",
        name: "meta" as const,
      },
    ];

    const result = await service.acceptInlineIngest(ctx, {
      parts,
      title: "Inline report",
    });

    expect(result.status).toBe("processing");
    expect(putCalls).toHaveLength(4);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.reportId).toBe(result.reportId);
    expect(enqueued[0]?.r2Keys).toHaveLength(4);

    const [report] = await db
      .select({ ingestStatus: reports.ingestStatus })
      .from(reports)
      .where(eq(reports.id, result.reportId));
    expect(report?.ingestStatus).toBe("processing");
  });

  test("inline ingest rejects payloads over 1 MB", async () => {
    const { service } = createService();
    const oversized = new Uint8Array(1_048_577);

    await expect(
      service.acceptInlineIngest(
        {
          idempotencyKey: "idem-inline-oversize",
          organizationId: orgId,
          projectId,
          requestId: "req_test",
        },
        {
          parts: [
            {
              body: oversized,
              contentType: "application/gzip",
              name: "replay",
              seq: 0,
            },
            {
              body: new Uint8Array([1]),
              contentType: "application/gzip",
              name: "console",
            },
            {
              body: new Uint8Array([1]),
              contentType: "application/gzip",
              name: "network",
            },
            {
              body: new Uint8Array([1]),
              contentType: "application/json",
              name: "meta",
            },
          ],
        }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  test("inline idempotency skips re-upload when processing", async () => {
    const { enqueued, putCalls, service } = createService({
      generateId: () => "rpt_inline_idem",
    });
    const ctx = {
      idempotencyKey: "idem-inline-processing",
      organizationId: orgId,
      projectId,
      requestId: "req_test",
    };
    const parts = [
      {
        body: new Uint8Array([1]),
        contentType: "application/gzip",
        name: "replay" as const,
        seq: 0,
      },
      {
        body: new Uint8Array([2]),
        contentType: "application/gzip",
        name: "console" as const,
      },
      {
        body: new Uint8Array([3]),
        contentType: "application/gzip",
        name: "network" as const,
      },
      {
        body: new Uint8Array([4]),
        contentType: "application/json",
        name: "meta" as const,
      },
    ];

    const first = await service.acceptInlineIngest(ctx, { parts });
    const second = await service.acceptInlineIngest(ctx, { parts });

    expect(second.reportId).toBe(first.reportId);
    expect(second.status).toBe("processing");
    expect(putCalls).toHaveLength(4);
    expect(enqueued).toHaveLength(1);
  });

  test("processFinalizeJob writes blobs, completes report, increments usage", async () => {
    const { service } = createService({ generateId: () => "rpt_finalize_1" });
    const ctx = {
      idempotencyKey: "idem-finalize-1",
      organizationId: orgId,
      projectId,
      requestId: "req_test",
    };
    const presign = await service.presignUpload(ctx, {
      parts: [
        { contentType: "application/gzip", name: "replay", seq: 0 },
        { contentType: "application/gzip", name: "console" },
        { contentType: "application/gzip", name: "network" },
        { contentType: "application/json", name: "meta" },
      ],
      title: "Finalize me",
    });

    const r2Keys = [
      `${orgId}/${projectId}/${presign.reportId}/replay/batch-0.json.gz`,
      `${orgId}/${projectId}/${presign.reportId}/console.json.gz`,
      `${orgId}/${projectId}/${presign.reportId}/network.json.gz`,
      `${orgId}/${projectId}/${presign.reportId}/meta.json`,
    ];

    await db
      .update(reports)
      .set({ ingestStatus: "processing" })
      .where(eq(reports.id, presign.reportId));

    const result = await service.processFinalizeJob({
      idempotencyKey: ctx.idempotencyKey,
      projectId,
      r2Keys,
      reportId: presign.reportId,
    });

    expect(result.status).toBe("complete");

    const blobs = await db
      .select()
      .from(reportBlobs)
      .where(eq(reportBlobs.reportId, presign.reportId));
    expect(blobs).toHaveLength(4);

    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, presign.reportId));
    expect(report?.ingestStatus).toBe("complete");
    expect(report?.summaryText).toContain("Finalize me");

    const [usage] = await db
      .select()
      .from(workspaceUsageMonthly)
      .where(eq(workspaceUsageMonthly.organizationId, orgId));
    expect(usage?.reportCount).toBe(1);
  });

  test("processFinalizeJob is idempotent when already complete", async () => {
    const { service } = createService({ generateId: () => "rpt_finalize_2" });
    const ctx = {
      idempotencyKey: "idem-finalize-2",
      organizationId: orgId,
      projectId,
      requestId: "req_test",
    };
    const presign = await service.presignUpload(ctx, {
      parts: [{ contentType: "application/json", name: "meta" }],
      title: "Done",
    });
    const r2Keys = [`${orgId}/${projectId}/${presign.reportId}/meta.json`];

    await db
      .update(reports)
      .set({ ingestStatus: "processing" })
      .where(eq(reports.id, presign.reportId));

    await service.processFinalizeJob({
      idempotencyKey: ctx.idempotencyKey,
      projectId,
      r2Keys,
      reportId: presign.reportId,
    });

    await service.processFinalizeJob({
      idempotencyKey: ctx.idempotencyKey,
      projectId,
      r2Keys,
      reportId: presign.reportId,
    });

    const blobs = await db
      .select()
      .from(reportBlobs)
      .where(eq(reportBlobs.reportId, presign.reportId));
    expect(blobs).toHaveLength(1);

    const [usage] = await db
      .select()
      .from(workspaceUsageMonthly)
      .where(eq(workspaceUsageMonthly.organizationId, orgId));
    expect(usage?.reportCount).toBe(1);
  });
});
