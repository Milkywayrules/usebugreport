---
baseline_commit: ce7015f
depends_on:
  - 5-2-mcp-read-tools-from-surface-registry
  - 6-4-rest-parity-contract-tests-real-http
blocks: []
---

# Story 5.3: MCP parity contract tests (Streamable HTTP)

Status: review

## Story

As a CI pipeline,
I want parity tests exercising real MCP Streamable HTTP against live app,
so that MCP and REST cannot diverge (AD-2, FR-18).

## Acceptance Criteria

1. Registry read ops compared via live REST `fetch()` and MCP Streamable HTTP client.
2. Auth scope and pagination/filter parity asserted.
3. Write probe returns FORBIDDEN when key lacks `reports:write`.

## Dev Agent Record

- Extended `packages/contracts/tests/parity.test.ts` with MCP Streamable HTTP suite.
