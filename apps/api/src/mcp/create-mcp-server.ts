// @ts-nocheck — MCP SDK registerTool inference blows TS stack on async handlers.
import type {
  AuthContext,
  ReportService,
  SearchService,
} from "@usebugreport/services";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleMcpReadTool } from "./mcp-read-handlers";
import { assertMcpToolAllowed, assertMcpWriteScope } from "./tool-auth";
import { MCP_TOOL_REGISTRATIONS, type McpToolName } from "./tools/registry";

export interface CreateMcpServerDeps {
  authContext: AuthContext;
  reportService: ReportService;
  searchService: SearchService;
}

export function createMcpServer(deps: CreateMcpServerDeps): McpServer {
  const server = new McpServer({
    name: "usebugreport",
    version: "1.0.0",
  });

  for (const toolName of Object.keys(MCP_TOOL_REGISTRATIONS) as McpToolName[]) {
    const registration = MCP_TOOL_REGISTRATIONS[toolName];
    server.registerTool(
      toolName,
      {
        description: `Read ${registration.surfaceId} via ReportService/SearchService.`,
        inputSchema: {
          cursor: z.string().optional(),
          limit: z.number().optional(),
          projectId: z.string().optional(),
          query: z.string().optional(),
          reportId: z.string().optional(),
        },
      },
      async (args: Record<string, unknown>) => {
        assertMcpToolAllowed(deps.authContext, toolName);
        const text = await handleMcpReadTool(
          {
            authContext: deps.authContext,
            reportService: deps.reportService,
            searchService: deps.searchService,
          },
          toolName,
          args ?? {}
        );
        return {
          content: [{ text, type: "text" as const }],
        };
      }
    );
  }

  server.registerTool(
    "reports_write_check",
    {
      description: "Auth probe for reports:write scope (E5-S1).",
      inputSchema: {},
    },
    async () => {
      assertMcpWriteScope(deps.authContext);
      return {
        content: [{ text: "write scope ok", type: "text" as const }],
      };
    }
  );

  return server;
}
