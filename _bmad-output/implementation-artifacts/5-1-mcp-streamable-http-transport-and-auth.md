---
baseline_commit: 1c37d9f
depends_on:
  - 6-1-domain-services-and-ad-1-lint-gate
blocks:
  - 5-2-mcp-read-tools-from-surface-registry
---

# Story 5.1: MCP Streamable HTTP transport and auth

Status: review

## Story

As an AI agent,
I want to authenticate to `/mcp` with Workspace API keys,
so that tools run scoped to my workspace.

## Acceptance Criteria

1. `POST /mcp` accepts `Authorization: Bearer ubr_live_*` and runs Streamable HTTP transport.
2. Invalid or missing keys return HTTP 401 before MCP handling.
3. Write-scope probe tool returns forbidden for read-only keys (Free-tier read-only).
4. Launch read tools registered with auth guard (handlers stubbed until E5-S2).

## Dev Agent Record

### Completion Notes

- `@modelcontextprotocol/sdk` Streamable HTTP via `WebStandardStreamableHTTPServerTransport`.
- `registerMcpRoutes` resolves the same API key auth context as REST.
- Integration tests in `mcp-transport.integration.test.ts` (require `DATABASE_URL`).
