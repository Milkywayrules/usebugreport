---
baseline_commit: cd3ba44
depends_on:
  - 5-1-mcp-streamable-http-transport-and-auth
  - 6-2-surface-registry-and-route-validation
blocks:
  - 5-3-mcp-parity-contract-tests-streamable-http
---

# Story 5.2: MCP read tools from surface registry

Status: review

## Story

As an AI agent,
I want list, get, summary, console, network, and search tools,
so that I can triage reports without custom glue.

## Acceptance Criteria

1. Each launch read registry tool calls matching ReportService/SearchService methods.
2. Tool auth scopes enforced via surface registry.
3. No replay/presigned URL tools registered.

## Dev Agent Record

- `mcp-read-handlers.ts` wired through `createMcpServer`.
