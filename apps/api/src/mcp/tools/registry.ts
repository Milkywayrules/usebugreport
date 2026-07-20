/** MCP read tool registrations (transport wired in E5-S1). */
export const MCP_TOOL_REGISTRATIONS = {
  list_reports: { surfaceId: "reports.list", tool: "list_reports" },
  get_report: { surfaceId: "reports.get", tool: "get_report" },
  get_report_summary: { surfaceId: "reports.summary", tool: "get_report_summary" },
  get_console_logs: { surfaceId: "reports.console_logs", tool: "get_console_logs" },
  get_network_requests: {
    surfaceId: "reports.network_requests",
    tool: "get_network_requests",
  },
  search_reports: { surfaceId: "reports.search", tool: "search_reports" },
} as const;

export type McpToolName = keyof typeof MCP_TOOL_REGISTRATIONS;
