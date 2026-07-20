import type {
  AuthContext,
  ReportService,
  SearchService,
} from "@usebugreport/services";
import { ServiceError } from "@usebugreport/services";

export interface McpReadHandlerDeps {
  authContext: AuthContext;
  reportService: ReportService;
  searchService: SearchService;
}

function jsonText(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function serializeDates<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    }
  }
  return out as T;
}

export async function handleMcpReadTool(
  deps: McpReadHandlerDeps,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const ctx = deps.authContext;

  switch (toolName) {
    case "list_reports": {
      const page = await deps.reportService.listReports(ctx, {
        cursor: typeof args.cursor === "string" ? args.cursor : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
        projectId: typeof args.projectId === "string" ? args.projectId : undefined,
        q: typeof args.query === "string" ? args.query : undefined,
        since: typeof args.since === "string" ? new Date(args.since) : undefined,
        status: typeof args.status === "string" ? (args.status as never) : undefined,
      });
      return jsonText({
        data: page.data.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
        page: page.page,
      });
    }
    case "get_report": {
      const reportId = typeof args.reportId === "string" ? args.reportId : "";
      if (!reportId) {
        throw new ServiceError("VALIDATION_ERROR", "reportId is required.");
      }
      const report = await deps.reportService.getById(ctx, reportId);
      return jsonText({
        data: {
          ...serializeDates(report as unknown as Record<string, unknown>),
        },
      });
    }
    case "get_report_summary": {
      const reportId = typeof args.reportId === "string" ? args.reportId : "";
      if (!reportId) {
        throw new ServiceError("VALIDATION_ERROR", "reportId is required.");
      }
      const summary = await deps.reportService.getSummary(ctx, reportId);
      return jsonText({ data: summary });
    }
    case "get_console_logs": {
      const reportId = typeof args.reportId === "string" ? args.reportId : "";
      if (!reportId) {
        throw new ServiceError("VALIDATION_ERROR", "reportId is required.");
      }
      const logs = await deps.reportService.getConsoleLogs(ctx, reportId);
      return jsonText({ data: logs });
    }
    case "get_network_requests": {
      const reportId = typeof args.reportId === "string" ? args.reportId : "";
      if (!reportId) {
        throw new ServiceError("VALIDATION_ERROR", "reportId is required.");
      }
      const requests = await deps.reportService.getNetworkRequests(ctx, reportId);
      return jsonText({ data: requests });
    }
    case "search_reports": {
      const query = typeof args.query === "string" ? args.query : "";
      const page = await deps.searchService.searchReports(ctx, {
        cursor: typeof args.cursor === "string" ? args.cursor : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
        projectId: typeof args.projectId === "string" ? args.projectId : undefined,
        query,
        since: typeof args.since === "string" ? new Date(args.since) : undefined,
        status: typeof args.status === "string" ? (args.status as never) : undefined,
      });
      return jsonText({ data: page.data, page: page.page });
    }
    default:
      throw new ServiceError("NOT_FOUND", `Unknown MCP tool: ${toolName}.`);
  }
}
