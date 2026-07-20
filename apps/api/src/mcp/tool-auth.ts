import { SURFACE_REGISTRY } from "@usebugreport/contracts";
import {
  type ApiKeyScope,
  type AuthContext,
  requireApiKeyScope,
  ServiceError,
} from "@usebugreport/services";

function isLaunchGated(entry: (typeof SURFACE_REGISTRY)[number]): boolean {
  return "launchGate" in entry && entry.launchGate === false;
}

export function assertMcpToolAllowed(
  ctx: AuthContext,
  toolName: string
): void {
  const entry = SURFACE_REGISTRY.find(
    (row) => row.mcp.tool === toolName && !isLaunchGated(row)
  );
  if (!entry) {
    throw new ServiceError("NOT_FOUND", `Unknown MCP tool: ${toolName}.`);
  }

  for (const scope of entry.scopes) {
    requireApiKeyScope(ctx, scope as ApiKeyScope);
  }
}

export function assertMcpWriteScope(ctx: AuthContext): void {
  requireApiKeyScope(ctx, "reports:write");
}
