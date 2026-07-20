import type { DbClient } from "@usebugreport/db";
import { reportComments, reports, user, workspaceApiKeys } from "@usebugreport/db";
import { and, asc, eq } from "drizzle-orm";
import { requireApiKeyScope } from "./api-key";
import { createRBACService } from "./rbac";
import { generatePrefixedId } from "./project";
import type { AuthContext } from "./types";
import { requireSessionUserId, ServiceError } from "./types";
import type { UsageService } from "./usage";

export interface ReportCommentRecord {
  authorDisplayName: string;
  authorType: "api_key" | "user";
  body: string;
  createdAt: Date;
  id: string;
  reportId: string;
}

export interface CreateCommentInput {
  body: string;
  dedupeKey?: string | null;
}

export interface CommentServiceDeps {
  usageService?: UsageService;
}

function normalizeBody(body: string): string {
  return body.trim();
}

function normalizeDedupeKey(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createCommentService(
  db: DbClient,
  deps: CommentServiceDeps = {}
) {
  const rbac = createRBACService(db);
  const { usageService } = deps;

  async function loadReport(reportId: string, organizationId: string) {
    const report = await db.query.reports.findFirst({
      columns: { id: true, organizationId: true, projectId: true },
      where: and(
        eq(reports.id, reportId),
        eq(reports.organizationId, organizationId)
      ),
    });

    if (!report) {
      throw new ServiceError("NOT_FOUND", "Report not found.");
    }

    return report;
  }

  async function findByDedupeKey(
    organizationId: string,
    reportId: string,
    dedupeKey: string
  ) {
    return db.query.reportComments.findFirst({
      columns: {
        authorDisplayName: true,
        authorType: true,
        body: true,
        createdAt: true,
        id: true,
        reportId: true,
      },
      where: and(
        eq(reportComments.organizationId, organizationId),
        eq(reportComments.reportId, reportId),
        eq(reportComments.dedupeKey, dedupeKey)
      ),
    });
  }

  return {
    async create(
      ctx: AuthContext,
      reportId: string,
      input: CreateCommentInput
    ): Promise<ReportCommentRecord> {
      const body = normalizeBody(input.body);
      if (!body) {
        throw new ServiceError("VALIDATION_ERROR", "Comment body is required.");
      }

      const dedupeKey = normalizeDedupeKey(input.dedupeKey);
      if (dedupeKey) {
        const existing = await findByDedupeKey(
          ctx.organizationId,
          reportId,
          dedupeKey
        );
        if (existing) {
          return existing;
        }
      }

      const report = await loadReport(reportId, ctx.organizationId);

      if (ctx.type === "session") {
        await rbac.requireProjectRole(ctx, report.projectId, "reporter");
      } else if (ctx.type === "api_key") {
        requireApiKeyScope(ctx, "reports:write");
        if (usageService) {
          const tier = await usageService.checkTierLimit(ctx, "mcp_write");
          if (!tier.allowed) {
            throw new ServiceError("FORBIDDEN", tier.message, tier.details);
          }
        }
        const allowed = await rbac.canPerform(
          ctx,
          report.projectId,
          "report:comment"
        );
        if (!allowed) {
          throw new ServiceError(
            "FORBIDDEN",
            "Insufficient project permissions."
          );
        }
      } else {
        throw new ServiceError("FORBIDDEN", "Authentication required.");
      }

      let authorDisplayName = "Member";
      let authorUserId: string | null = null;
      let authorApiKeyId: string | null = null;
      let authorType: "api_key" | "user" = "user";

      if (ctx.type === "session") {
        authorUserId = requireSessionUserId(ctx);
        const author = await db.query.user.findFirst({
          columns: { name: true },
          where: eq(user.id, authorUserId),
        });
        authorDisplayName = author?.name?.trim() || "Member";
      } else {
        authorType = "api_key";
        authorApiKeyId = ctx.apiKeyId ?? null;
        if (!authorApiKeyId) {
          throw new ServiceError("FORBIDDEN", "API key required.");
        }
        const keyRow = await db.query.workspaceApiKeys.findFirst({
          columns: { name: true },
          where: eq(workspaceApiKeys.id, authorApiKeyId),
        });
        authorDisplayName = keyRow?.name?.trim() || "Agent";
      }

      const id = generatePrefixedId("cmt");
      try {
        const [row] = await db
          .insert(reportComments)
          .values({
            authorApiKeyId,
            authorDisplayName,
            authorType,
            authorUserId,
            body,
            dedupeKey,
            id,
            organizationId: ctx.organizationId,
            reportId,
          })
          .returning({
            authorDisplayName: reportComments.authorDisplayName,
            authorType: reportComments.authorType,
            body: reportComments.body,
            createdAt: reportComments.createdAt,
            id: reportComments.id,
            reportId: reportComments.reportId,
          });

        if (!row) {
          throw new Error("Failed to create comment.");
        }

        return row;
      } catch (error) {
        if (dedupeKey) {
          const existing = await findByDedupeKey(
            ctx.organizationId,
            reportId,
            dedupeKey
          );
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
    },

    async list(
      ctx: AuthContext,
      reportId: string
    ): Promise<{ canComment: boolean; comments: ReportCommentRecord[] }> {
      const report = await loadReport(reportId, ctx.organizationId);
      const allowed = await rbac.canPerform(ctx, report.projectId, "project:read");
      if (!allowed) {
        throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
      }

      const rows = await db
        .select({
          authorDisplayName: reportComments.authorDisplayName,
          authorType: reportComments.authorType,
          body: reportComments.body,
          createdAt: reportComments.createdAt,
          id: reportComments.id,
          reportId: reportComments.reportId,
        })
        .from(reportComments)
        .where(
          and(
            eq(reportComments.reportId, reportId),
            eq(reportComments.organizationId, ctx.organizationId)
          )
        )
        .orderBy(asc(reportComments.createdAt));

      const canComment = await rbac.canPerform(
        ctx,
        report.projectId,
        "report:comment"
      );

      return { canComment, comments: rows };
    },
  };
}

export type CommentService = ReturnType<typeof createCommentService>;
