import { z } from "zod";

export const surfaceRestSchema = z.object({
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
  path: z.string().min(1),
});

export const surfaceMcpSchema = z.object({
  tool: z.string().min(1),
});

export const surfaceRegistryEntrySchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  method: z.string().min(1),
  rest: surfaceRestSchema,
  mcp: surfaceMcpSchema,
  scopes: z.array(z.string().min(1)).min(1),
  launchGate: z.boolean().optional(),
});

export type SurfaceRegistryEntry = z.infer<typeof surfaceRegistryEntrySchema>;

export const SURFACE_REGISTRY = [
  {
    id: "reports.list",
    service: "ReportService",
    method: "list",
    rest: { method: "GET", path: "/api/v1/reports" },
    mcp: { tool: "list_reports" },
    scopes: ["reports:read"],
  },
  {
    id: "reports.get",
    service: "ReportService",
    method: "getById",
    rest: { method: "GET", path: "/api/v1/reports/:id" },
    mcp: { tool: "get_report" },
    scopes: ["reports:read"],
  },
  {
    id: "reports.summary",
    service: "ReportService",
    method: "getSummary",
    rest: { method: "GET", path: "/api/v1/reports/:id/summary" },
    mcp: { tool: "get_report_summary" },
    scopes: ["reports:read"],
  },
  {
    id: "reports.console_logs",
    service: "ReportService",
    method: "getConsoleLogs",
    rest: { method: "GET", path: "/api/v1/reports/:id/console-logs" },
    mcp: { tool: "get_console_logs" },
    scopes: ["reports:read"],
  },
  {
    id: "reports.network_requests",
    service: "ReportService",
    method: "getNetworkRequests",
    rest: { method: "GET", path: "/api/v1/reports/:id/network-requests" },
    mcp: { tool: "get_network_requests" },
    scopes: ["reports:read"],
  },
  {
    id: "reports.search",
    service: "SearchService",
    method: "searchReports",
    rest: { method: "GET", path: "/api/v1/reports/search" },
    mcp: { tool: "search_reports" },
    scopes: ["reports:read"],
  },
  {
    id: "comments.create",
    service: "CommentService",
    method: "create",
    rest: { method: "POST", path: "/api/v1/reports/:id/comments" },
    mcp: { tool: "create_comment" },
    scopes: ["reports:write"],
    launchGate: false,
  },
] as const satisfies readonly SurfaceRegistryEntry[];

export type SurfaceRegistryId = (typeof SURFACE_REGISTRY)[number]["id"];

for (const entry of SURFACE_REGISTRY) {
  surfaceRegistryEntrySchema.parse(entry);
}
