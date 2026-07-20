import { gunzipSync } from "node:zlib";
import type { DbClient } from "@usebugreport/db";
import { reportBlobs, reports } from "@usebugreport/db";
import type { R2Client } from "@usebugreport/storage";
import { and, eq } from "drizzle-orm";
import { requireApiKeyScope } from "./api-key";
import { createRBACService } from "./rbac";
import type { AuthContext } from "./types";
import { ServiceError } from "./types";

const DEFAULT_REPLAY_PRESIGN_SECONDS = 900;

export interface ReportServiceDeps {
  presignTtlSeconds?: number;
  r2: Pick<R2Client, "getObject" | "presignGet">;
}

export interface ReportRecord {
  createdAt: Date;
  description: string | null;
  environment: Record<string, unknown>;
  id: string;
  ingestStatus: "complete" | "failed" | "pending" | "processing";
  organizationId: string;
  projectId: string;
  status: "closed" | "duplicate" | "in_progress" | "open" | "resolved";
  summary: Record<string, unknown>;
  summaryText: string | null;
  title: string;
  updatedAt: Date;
}

export interface ReplayManifestBatch {
  expiresAt: string;
  seq: number;
  url: string;
}

export interface ReplayManifest {
  batches: ReplayManifestBatch[];
  screenshotUrl: string | null;
}

function gunzipJson(bytes: Uint8Array): unknown {
  const json = gunzipSync(Buffer.from(bytes));
  return JSON.parse(json.toString("utf8"));
}

function assertReportsReadScope(ctx: AuthContext): void {
  if (ctx.type === "api_key") {
    requireApiKeyScope(ctx, "reports:read");
  }
}

export function createReportService(db: DbClient, deps: ReportServiceDeps) {
  const rbac = createRBACService(db);
  const presignTtlSeconds =
    deps.presignTtlSeconds ?? DEFAULT_REPLAY_PRESIGN_SECONDS;

  async function loadReportRow(
    ctx: AuthContext,
    reportId: string
  ): Promise<ReportRecord> {
    assertReportsReadScope(ctx);

    const [row] = await db
      .select({
        createdAt: reports.createdAt,
        description: reports.description,
        environment: reports.environment,
        id: reports.id,
        ingestStatus: reports.ingestStatus,
        organizationId: reports.organizationId,
        projectId: reports.projectId,
        status: reports.status,
        summary: reports.summary,
        summaryText: reports.summaryText,
        title: reports.title,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .where(
        and(
          eq(reports.id, reportId),
          eq(reports.organizationId, ctx.organizationId)
        )
      )
      .limit(1);

    if (!row) {
      throw new ServiceError("NOT_FOUND", "Report not found.");
    }

    const canRead = await rbac.canPerform(ctx, row.projectId, "project:read");
    if (!canRead) {
      throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
    }

    return {
      ...row,
      environment: (row.environment ?? {}) as Record<string, unknown>,
      summary: (row.summary ?? {}) as Record<string, unknown>,
    };
  }

  async function loadBlobKey(
    reportId: string,
    type: "console" | "network"
  ): Promise<string | null> {
    const [blob] = await db
      .select({ r2Key: reportBlobs.r2Key })
      .from(reportBlobs)
      .where(
        and(eq(reportBlobs.reportId, reportId), eq(reportBlobs.type, type))
      )
      .limit(1);

    return blob?.r2Key ?? null;
  }

  return {
    getById(ctx: AuthContext, reportId: string): Promise<ReportRecord> {
      return loadReportRow(ctx, reportId);
    },

    async getConsoleLogs(ctx: AuthContext, reportId: string): Promise<unknown> {
      await loadReportRow(ctx, reportId);
      const key = await loadBlobKey(reportId, "console");
      if (!key) {
        return [];
      }
      const bytes = await deps.r2.getObject(key);
      const parsed = gunzipJson(bytes);
      return Array.isArray(parsed) ? parsed : parsed;
    },

    async getNetworkRequests(
      ctx: AuthContext,
      reportId: string
    ): Promise<unknown> {
      await loadReportRow(ctx, reportId);
      const key = await loadBlobKey(reportId, "network");
      if (!key) {
        return [];
      }
      const bytes = await deps.r2.getObject(key);
      const parsed = gunzipJson(bytes);
      return Array.isArray(parsed) ? parsed : parsed;
    },

    async getReplayManifest(
      ctx: AuthContext,
      reportId: string
    ): Promise<ReplayManifest> {
      await loadReportRow(ctx, reportId);

      const blobs = await db
        .select({
          expiresAt: reportBlobs.expiresAt,
          r2Key: reportBlobs.r2Key,
          seq: reportBlobs.seq,
          type: reportBlobs.type,
        })
        .from(reportBlobs)
        .where(eq(reportBlobs.reportId, reportId));

      const replayBlobs = blobs
        .filter((blob) => blob.type === "replay")
        .sort((a, b) => a.seq - b.seq);

      const expiresAtIso = new Date(
        Date.now() + presignTtlSeconds * 1000
      ).toISOString();

      const batchUrls = await Promise.all(
        replayBlobs.map((blob) =>
          deps.r2.presignGet(blob.r2Key, presignTtlSeconds)
        )
      );

      const batches: ReplayManifestBatch[] = replayBlobs.map((blob, index) => ({
        expiresAt: expiresAtIso,
        seq: blob.seq,
        url: batchUrls[index] ?? "",
      }));

      const screenshotBlob = blobs.find((blob) => blob.type === "screenshot");
      const screenshotUrl = screenshotBlob
        ? await deps.r2.presignGet(screenshotBlob.r2Key, presignTtlSeconds)
        : null;

      return { batches, screenshotUrl };
    },

    async getSummary(
      ctx: AuthContext,
      reportId: string
    ): Promise<{
      reportId: string;
      summary: Record<string, unknown>;
      summaryText: string | null;
    }> {
      const report = await loadReportRow(ctx, reportId);
      return {
        reportId: report.id,
        summary: report.summary,
        summaryText: report.summaryText,
      };
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
