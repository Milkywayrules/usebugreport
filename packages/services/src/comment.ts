import type { DbClient } from "@usebugreport/db";
import { reportComments, reports, user } from "@usebugreport/db";
import { and, asc, eq } from "drizzle-orm";
import { createRBACService } from "./rbac";
import { generatePrefixedId } from "./project";
import type { AuthContext } from "./types";
import { requireSessionUserId, ServiceError } from "./types";

export interface ReportCommentRecord {
  authorDisplayName: string;
  body: string;
  createdAt: Date;
  id: string;
  reportId: string;
}

export interface CreateCommentInput {
  body: string;
}

function normalizeBody(body: string): string {
  return body.trim();
}

export function createCommentService(db: DbClient) {
  const rbac = createRBACService(db);

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

  return {
    async create(
      ctx: AuthContext,
      reportId: string,
      input: CreateCommentInput
    ): Promise<ReportCommentRecord> {
      if (ctx.type !== "session") {
        throw new ServiceError(
          "FORBIDDEN",
          "Comments via web session require a signed-in user."
        );
      }

      const body = normalizeBody(input.body);
      if (!body) {
        throw new ServiceError("VALIDATION_ERROR", "Comment body is required.");
      }

      const report = await loadReport(reportId, ctx.organizationId);
      await rbac.requireProjectRole(ctx, report.projectId, "reporter");

      const authorUserId = requireSessionUserId(ctx);
      const author = await db.query.user.findFirst({
        columns: { name: true },
        where: eq(user.id, authorUserId),
      });
      const authorDisplayName = author?.name?.trim() || "Member";

      const id = generatePrefixedId("cmt");
      const [row] = await db
        .insert(reportComments)
        .values({
          authorDisplayName,
          authorType: "user",
          authorUserId,
          body,
          id,
          organizationId: ctx.organizationId,
          reportId,
        })
        .returning({
          authorDisplayName: reportComments.authorDisplayName,
          body: reportComments.body,
          createdAt: reportComments.createdAt,
          id: reportComments.id,
          reportId: reportComments.reportId,
        });

      if (!row) {
        throw new Error("Failed to create comment.");
      }

      return row;
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
