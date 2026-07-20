import type { DbClient } from "@usebugreport/db";
import { reports } from "@usebugreport/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { requireApiKeyScope } from "./api-key";
import { createRBACService, type RBACService } from "./rbac";
import type { AuthContext, CursorPage } from "./types";
import { ServiceError } from "./types";

export interface SearchReportsOptions {
  cursor?: string;
  limit?: number;
  projectId?: string;
  query: string;
  since?: Date;
  status?: "closed" | "duplicate" | "in_progress" | "open" | "resolved";
}

export interface SearchReportHit {
  id: string;
  rank: number;
  snippet: string | null;
  status: "closed" | "duplicate" | "in_progress" | "open" | "resolved";
  title: string;
}

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 50;

function encodeCursor(rank: number, id: string): string {
  return Buffer.from(JSON.stringify({ id, rank })).toString("base64url");
}

function decodeCursor(cursor: string): { id: string; rank: number } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { id: string; rank: number };
    if (typeof parsed.id !== "string" || typeof parsed.rank !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function assertReportsReadScope(ctx: AuthContext): void {
  if (ctx.type === "api_key") {
    requireApiKeyScope(ctx, "reports:read");
  }
}

function normalizeSearchLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT);
}

function buildSearchFilters(
  ctx: AuthContext,
  options: SearchReportsOptions,
  accessible: string[] | "all",
  query: string
) {
  const conditions = [
    eq(reports.organizationId, ctx.organizationId),
    sql`${reports.searchVector} @@ websearch_to_tsquery('english', ${query})`,
  ];

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

  return conditions;
}

async function assertProjectSearchAccess(
  rbac: RBACService,
  ctx: AuthContext,
  projectId?: string
): Promise<void> {
  if (!projectId) {
    return;
  }
  const canRead = await rbac.canPerform(ctx, projectId, "project:read");
  if (!canRead) {
    throw new ServiceError("FORBIDDEN", "Insufficient project permissions.");
  }
}

function mapSearchPage(
  rows: Array<{
    id: string;
    rank: number | string;
    snippet: string | null;
    status: SearchReportHit["status"];
    title: string;
  }>,
  limit: number
): CursorPage<SearchReportHit> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const data: SearchReportHit[] = pageRows.map((row) => ({
    id: row.id,
    rank: Number(row.rank),
    snippet: row.snippet,
    status: row.status,
    title: row.title,
  }));
  const last = pageRows.at(-1);
  return {
    data,
    page: {
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor(Number(last.rank), last.id) : null,
    },
  };
}

export function createSearchService(db: DbClient) {
  const rbac = createRBACService(db);

  return {
    async searchReports(
      ctx: AuthContext,
      options: SearchReportsOptions
    ): Promise<CursorPage<SearchReportHit>> {
      assertReportsReadScope(ctx);

      const query = options.query.trim();
      if (!query) {
        throw new ServiceError("VALIDATION_ERROR", "query is required.");
      }

      const limit = normalizeSearchLimit(options.limit);
      await assertProjectSearchAccess(rbac, ctx, options.projectId);

      const accessible = await rbac.listAccessibleProjectIds(ctx);
      if (accessible !== "all" && accessible.length === 0) {
        return {
          data: [],
          page: { hasMore: false, nextCursor: null },
        };
      }

      const decoded = options.cursor ? decodeCursor(options.cursor) : null;
      if (options.cursor && !decoded) {
        throw new ServiceError("VALIDATION_ERROR", "Invalid cursor.");
      }

      const conditions = buildSearchFilters(ctx, options, accessible, query);
      const rankExpr = sql<number>`ts_rank_cd(${reports.searchVector}, websearch_to_tsquery('english', ${query}))`;

      if (decoded) {
        conditions.push(
          sql`(${rankExpr}, ${reports.id}) < (${decoded.rank}, ${decoded.id})`
        );
      }

      const rows = await db
        .select({
          id: reports.id,
          rank: rankExpr,
          snippet: sql<
            string | null
          >`ts_headline('english', coalesce(${reports.title}, '') || ' ' || coalesce(${reports.description}, '') || ' ' || coalesce(${reports.summaryText}, ''), websearch_to_tsquery('english', ${query}))`,
          status: reports.status,
          title: reports.title,
        })
        .from(reports)
        .where(and(...conditions))
        .orderBy(sql`${rankExpr} desc`, sql`${reports.id} desc`)
        .limit(limit + 1);

      return mapSearchPage(rows, limit);
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
