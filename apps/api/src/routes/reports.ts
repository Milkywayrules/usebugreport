import {
  createReportService,
  createSearchService,
  ServiceError,
} from "@usebugreport/services";
import type { Elysia } from "elysia";
import { db } from "../lib/auth";
import { getEnv } from "../lib/env";
import { serviceErrorToHttp } from "../lib/errors";
import { INTEGRATION_PUBLIC_TAG } from "../lib/route-tags";
import { resolveAuthContext } from "../middleware/auth-context";
import { requireSession } from "../middleware/session";
import { createR2Client } from "@usebugreport/storage";

type SessionHandlerContext = Parameters<typeof requireSession>[0];

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

function parseSince(value: string | null): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed);
}

export function registerReportRoutes(app: unknown): unknown {
  const routeApp = app as Elysia;
  const env = getEnv();
  const r2 = createR2Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
  const reportService = createReportService(db, { r2 });
  const searchService = createSearchService(db);

  return routeApp
    .get(
      "/api/v1/reports",
      async (context) => {
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
            requestId: authResult.value.requestId,
          };
        } catch (error) {
          return handleServiceError(error, authResult.value.requestId);
        }
      },
      {
        detail: {
          tags: [INTEGRATION_PUBLIC_TAG],
        },
      }
    )
    .get("/api/v1/reports/search", async (context) => {
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
          requestId: authResult.value.requestId,
        };
      } catch (error) {
        return handleServiceError(error, authResult.value.requestId);
      }
    });
}
