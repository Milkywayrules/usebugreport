import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthContext } from "@usebugreport/services";
import type { Elysia } from "elysia";
import { unauthorizedError } from "../lib/errors";
import { parseBearerToken } from "../middleware/api-key-auth";
import { createMcpServer } from "./create-mcp-server";

export interface McpRouteDeps {
  resolveAuth: (
    authorization: string | null,
    requestId: string
  ) => Promise<AuthContext | null>;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export function registerMcpRoutes(app: unknown, deps: McpRouteDeps): unknown {
  const routeApp = app as Elysia;

  return routeApp.all("/mcp", async (context) => {
    const requestId =
      "requestId" in context && typeof context.requestId === "string"
        ? context.requestId
        : crypto.randomUUID();

    const bearer = parseBearerToken(context.request);
    if (!bearer?.startsWith("ubr_live_")) {
      return jsonResponse(
        unauthorizedError("API key required.", requestId),
        401
      );
    }

    const authContext = await deps.resolveAuth(
      context.request.headers.get("authorization"),
      requestId
    );

    if (!authContext) {
      return jsonResponse(
        unauthorizedError("Invalid or expired API key.", requestId),
        401
      );
    }

    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = createMcpServer({ authContext });
    await server.connect(transport);
    return transport.handleRequest(context.request);
  });
}
