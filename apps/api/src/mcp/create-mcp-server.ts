import { MCP_TOOL_REGISTRATIONS } from "./tools/registry";
import { assertMcpToolAllowed, assertMcpWriteScope } from "./tool-auth";
import type { AuthContext } from "@usebugreport/services";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface CreateMcpServerDeps {
  authContext: AuthContext;
}

export function createMcpServer(deps: CreateMcpServerDeps): McpServer {
  const server = new McpServer({
    name: "usebugreport",
    version: "1.0.0",
  });

  for (const registration of Object.values(MCP_TOOL_REGISTRATIONS)) {
    server.registerTool(
      registration.tool,
      {
        description: `Read tool for ${registration.surfaceId} (transport E5-S1).`,
        inputSchema: {
          cursor: z.string().optional(),
          limit: z.number().optional(),
          projectId: z.string().optional(),
          query: z.string().optional(),
          reportId: z.string().optional(),
        },
      },
      async () => {
        assertMcpToolAllowed(deps.authContext, registration.tool);
        return {
          content: [
            {
              text: `${registration.tool} handler lands in E5-S2.`,
              type: "text" as const,
            },
          ],
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
