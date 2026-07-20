import {
  type ReportService,
  type SearchService,
  ServiceError,
} from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { serviceErrorToHttp } from "../lib/errors";
import { readJsonBody } from "../lib/request-body";
import { INTEGRATION_PUBLIC_TAG } from "../lib/route-tags";
import {
  type ReportAccessRequestContext,
  resolveReportReadAccess,
} from "../middleware/report-access";
import { resolveAuthContext } from "../middleware/auth-context";
import { requireSession } from "../middleware/session";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

export interface ReportRouteDeps {
  reportService: ReportService;
  searchService: SearchService;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function handleServiceError(error: unknown, requestId: string): Response {
  if (error instanceof ServiceError) {
    const mapped = serviceErrorToHttp(error, requestId);
    return jsonResponse(mapped.body, mapped.status);
  }
  throw error;
}


function toReportAccessContext(context: unknown): ReportAccessRequestContext {
  const ctx = context as ReportAccessRequestContext & { requestId: string };
  return {
    apiKeyAuth: ctx.apiKeyAuth ?? null,
    request: ctx.request,
    requestId: ctx.requestId,
    session: ctx.session ?? null,
    user: ctx.user ?? null,
  };
}

async function authorizeReportRead(context: unknown) {
  return resolveReportReadAccess(db, toReportAccessContext(context));
}

function parseSince(value: string | null): Date | undefined {
  if (!value?.trim()) {
    return;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return;
  }
  return new Date(parsed);
}

export function registerReportRoutes(
  app: unknown,
  deps: ReportRouteDeps
): unknown {
  const routeApp = app as Elysia;
  const { reportService, searchService } = deps;

  return routeApp
    .get(
      "/api/v1/reports",
      async (context) => {
        const access = await authorizeReportRead(context);
        if (!access.ok) {
          return jsonResponse(access.body, access.status);
        }
        const resolved = access.ctx;
        const requestId = access.requestId;

        const url = new URL(context.request.url);
        const q = url.searchParams.get("q") ?? undefined;
        const statusParam = url.searchParams.get("status") ?? undefined;
        const projectId = url.searchParams.get("project") ?? undefined;
        const cursor = url.searchParams.get("cursor") ?? undefined;
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
        const since = parseSince(url.searchParams.get("since"));

        try {
          const page = await reportService.listReports(resolved, {
            cursor,
            limit,
            projectId,
            q,
            since,
            status: statusParam as
              | "closed"
              | "duplicate"
              | "in_progress"
              | "open"
              | "resolved"
              | undefined,
          });

          return {
            data: page.data.map((row) => ({
              ...row,
              createdAt: row.createdAt.toISOString(),
            })),
            page: page.page,
            requestId,
          };
        } catch (error) {
          return handleServiceError(error, requestId);
        }
      },
      {
        detail: {
          tags: [INTEGRATION_PUBLIC_TAG],
        },
      }
    )

    .get("/api/v1/reports/:reportId", async (context) => {
      const access = await authorizeReportRead(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }
      const resolved = access.ctx;
      const requestId = access.requestId;

      try {
        const report = await reportService.getById(
          resolved,
          context.params.reportId
        );
        const org = await reportService.getOrganizationMeta(
          resolved,
          report.organizationId
        );

        return {
          data: {
            ...report,
            billingTier: org?.billingTier ?? "free",
            createdAt: report.createdAt.toISOString(),
            retentionDaysReplay: org?.retentionDaysReplay ?? 7,
            updatedAt: report.updatedAt.toISOString(),
            workspaceSlug: org?.slug ?? null,
          },
          requestId,
        };
      } catch (error) {
        return handleServiceError(error, requestId);
      }
    })
    .get("/api/v1/reports/:reportId/replay-manifest", async (context) => {
      const access = await authorizeReportRead(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }
      const resolved = access.ctx;
      const requestId = access.requestId;

      try {
        const report = await reportService.getById(
          resolved,
          context.params.reportId
        );
        const org = await reportService.getOrganizationMeta(
          resolved,
          report.organizationId
        );
        const expired = await reportService.isReplayExpired(
          resolved,
          report.id
        );
        const manifest = expired
          ? { batches: [], screenshotUrl: null }
          : await reportService.getReplayManifest(resolved, report.id);

        return {
          data: {
            billingTier: org?.billingTier ?? "free",
            manifest,
            replayExpired: expired,
            retentionDaysReplay: org?.retentionDaysReplay ?? 7,
          },
          requestId,
        };
      } catch (error) {
        return handleServiceError(error, requestId);
      }
    })
    .get("/api/v1/reports/:reportId/summary", async (context) => {
      const access = await authorizeReportRead(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }
      const resolved = access.ctx;
      const requestId = access.requestId;

      try {
        const summary = await reportService.getSummary(
          resolved,
          context.params.reportId
        );
        return {
          data: summary,
          requestId,
        };
      } catch (error) {
        return handleServiceError(error, requestId);
      }
    })

    .get("/api/v1/reports/:reportId/console-logs", async (context) => {
      const access = await authorizeReportRead(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }
      const resolved = access.ctx;
      const requestId = access.requestId;

      try {
        const logs = await reportService.getConsoleLogs(
          resolved,
          context.params.reportId
        );
        return {
          data: logs,
          requestId,
        };
      } catch (error) {
        return handleServiceError(error, requestId);
      }
    })
    .get("/api/v1/reports/:reportId/network-requests", async (context) => {
      const access = await authorizeReportRead(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }
      const resolved = access.ctx;
      const requestId = access.requestId;

      try {
        const requests = await reportService.getNetworkRequests(
          resolved,
          context.params.reportId
        );
        return {
          data: requests,
          requestId,
        };
      } catch (error) {
        return handleServiceError(error, requestId);
      }
    })
    .patch("/api/v1/reports/:reportId/status", async (context) => {
      const authResult = requireSession(
        context as unknown as SessionHandlerContext
      );
      if (!authResult.ok) {
        return jsonResponse(authResult.body, authResult.status);
      }

      const resolved = await resolveAuthContext(db, authResult.value);
      if ("error" in resolved) {
        return jsonResponse(
          {
            error: {
              code: "FORBIDDEN",
              message: "Active workspace required.",
              requestId: authResult.value.requestId,
            },
          },
          403
        );
      }

      const body = await readJsonBody<{ status?: unknown }>(context.request);
      if (!body?.status) {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "status is required.",
              requestId: authResult.value.requestId,
            },
          },
          422
        );
      }

      try {
        const report = await reportService.updateStatus(
          resolved,
          context.params.reportId,
          body.status as
            | "closed"
            | "duplicate"
            | "in_progress"
            | "open"
            | "resolved"
        );

        return {
          data: {
            ...report,
            createdAt: report.createdAt.toISOString(),
            updatedAt: report.updatedAt.toISOString(),
          },
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    })

    .get("/api/v1/reports/search", async (context) => {
      const access = await authorizeReportRead(context);
      if (!access.ok) {
        return jsonResponse(access.body, access.status);
      }
      const resolved = access.ctx;
      const requestId = access.requestId;

      const url = new URL(context.request.url);
      const query = url.searchParams.get("q") ?? "";

      try {
        const page = await searchService.searchReports(resolved, {
          cursor: url.searchParams.get("cursor") ?? undefined,
          limit: url.searchParams.get("limit")
            ? Number.parseInt(url.searchParams.get("limit") ?? "50", 10)
            : undefined,
          projectId: url.searchParams.get("project") ?? undefined,
          query,
          since: parseSince(url.searchParams.get("since")),
          status: (url.searchParams.get("status") ?? undefined) as
            | "closed"
            | "duplicate"
            | "in_progress"
            | "open"
            | "resolved"
            | undefined,
        });

        return {
          data: page.data,
          page: page.page,
          requestId,
        };
      } catch (error) {
        return handleServiceError(error, requestId);
      }
    });
}
