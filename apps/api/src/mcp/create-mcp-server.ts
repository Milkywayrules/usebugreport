import type { AuthContext } from "@usebugreport/services";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertMcpToolAllowed, assertMcpWriteScope } from "./tool-auth";
import { MCP_TOOL_REGISTRATIONS, type McpToolName } from "./tools/registry";

export interface CreateMcpServerDeps {
  authContext: AuthContext;
}

const stubToolMeta = {
  description: "Read tool (transport E5-S1; service wiring in E5-S2).",
  inputSchema: {},
} as const;

export function createMcpServer(deps: CreateMcpServerDeps): McpServer {
  const server = new McpServer({
    name: "usebugreport",
    version: "1.0.0",
  });

  for (const toolName of Object.keys(MCP_TOOL_REGISTRATIONS) as McpToolName[]) {
    server.registerTool(toolName, stubToolMeta, async () => {
      assertMcpToolAllowed(deps.authContext, toolName);
      return {
        content: [
          {
            text: `${toolName} handler lands in E5-S2.`,
            type: "text" as const,
          },
        ],
      };
    });
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
