import { gunzipSync } from "node:zlib";
import type { DbClient } from "@usebugreport/db";
import { reportBlobs, reports } from "@usebugreport/db";
import type { R2Client } from "@usebugreport/storage";
import { projects } from "@usebugreport/db";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { requireApiKeyScope } from "./api-key";
import { createRBACService } from "./rbac";
import type { AuthContext, CursorPage } from "./types";
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


export interface ListReportsOptions {
  cursor?: string;
  limit?: number;
  projectId?: string;
  q?: string;
  since?: Date;
  status?: ReportRecord["status"];
}

export interface ReportListItem {
  createdAt: Date;
  id: string;
  linearIssueUrl: string | null;
  projectId: string;
  projectName: string;
  reporterLabel: string | null;
  status: ReportRecord["status"];
  title: string;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 50;

function encodeListCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id })
  ).toString("base64url");
}

function decodeListCursor(
  cursor: string
): { createdAt: Date; id: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { createdAt: string; id: string };
    if (typeof parsed.id !== "string" || typeof parsed.createdAt !== "string") {
      return null;
    }
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
}

function normalizeListLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
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


    async listReports(
      ctx: AuthContext,
      options: ListReportsOptions = {}
    ): Promise<CursorPage<ReportListItem>> {
      assertReportsReadScope(ctx);
      const limit = normalizeListLimit(options.limit);
      const accessible = await rbac.listAccessibleProjectIds(ctx);
      if (accessible !== "all" && accessible.length === 0) {
        return { data: [], page: { hasMore: false, nextCursor: null } };
      }

      if (options.projectId) {
        const canRead = await rbac.canPerform(
          ctx,
          options.projectId,
          "project:read"
        );
        if (!canRead) {
          throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
        }
      }

      const decoded = options.cursor ? decodeListCursor(options.cursor) : null;
      if (options.cursor && !decoded) {
        throw new ServiceError("VALIDATION_ERROR", "Invalid cursor.");
      }

      const conditions = [eq(reports.organizationId, ctx.organizationId)];

      if (options.status) {
        conditions.push(eq(reports.status, options.status));
      }
      if (options.projectId) {
        conditions.push(eq(reports.projectId, options.projectId));
      } else if (accessible !== "all") {
        conditions.push(inArray(reports.projectId, accessible));
      }
      if (options.since) {
        conditions.push(gte(reports.createdAt, options.since));
      }
      const q = options.q?.trim();
      if (q) {
        const pattern = `%${q.replace(/[%_]/g, "")}%`;
        conditions.push(
          or(
            ilike(reports.title, pattern),
            ilike(reports.description, pattern)
          ) ?? sql`true`
        );
      }
      if (decoded) {
        conditions.push(
          or(
            lt(reports.createdAt, decoded.createdAt),
            and(eq(reports.createdAt, decoded.createdAt), lt(reports.id, decoded.id))
          ) ?? sql`true`
        );
      }

      const rows = await db
        .select({
          createdAt: reports.createdAt,
          id: reports.id,
          linearIssueUrl: reports.linearIssueUrl,
          projectId: reports.projectId,
          projectName: projects.name,
          reporterLabel: reports.reporterLabel,
          status: reports.status,
          title: reports.title,
        })
        .from(reports)
        .innerJoin(projects, eq(reports.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(reports.createdAt), desc(reports.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const last = pageRows.at(-1);

      return {
        data: pageRows,
        page: {
          hasMore,
          nextCursor:
            hasMore && last
              ? encodeListCursor(last.createdAt, last.id)
              : null,
        },
      };
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
