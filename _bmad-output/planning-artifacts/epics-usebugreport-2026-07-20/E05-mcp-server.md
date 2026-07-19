# Epic E5: MCP Server

**Goal:** Streamable HTTP MCP at `/mcp` with read tool suite and Free-tier read-only enforcement (LG-5, LG-6 partial).

**FRs:** FR-14, FR-15 | **ADs:** AD-1, AD-2

---

## Story E5-S1: MCP Streamable HTTP transport and auth

As an AI agent,
I want to authenticate to `/mcp` with Workspace API keys,
So that tools run scoped to my workspace (FR-14).

**Acceptance Criteria:**

**Given** `POST /mcp` with `Authorization: Bearer ubr_live_*`
**When** MCP Streamable HTTP session established via `@modelcontextprotocol/sdk` v1.x pinned
**Then** same API key middleware as REST resolves `AuthContext.organizationId` (architecture §5.4, AD-3)

**Given** Free tier key
**When** any write tool invoked (registry entries requiring `reports:write`)
**Then** MCP error envelope equivalent to HTTP 403 `FORBIDDEN` (FR-14, AD-11)

**Given** invalid key
**When** MCP request sent
**Then** auth error returned; no cross-workspace data (FR-14)

**Technical notes:** Handlers in `apps/api/src/mcp/tools/*.ts` — each ≤10 lines calling services (AD-1). No Drizzle in mcp folder (CI lint).

**Dependencies:** E4-S5, E6-S1 (services).

---

## Story E5-S2: MCP read tools from surface registry

As an AI agent,
I want list, get, summary, console, network, and search tools,
So that I can triage reports without custom glue (FR-15, LG-5).

**Acceptance Criteria:**

**Given** surface registry entries: `list_reports`, `get_report`, `get_report_summary`, `get_console_logs`, `get_network_requests`, `search_reports`
**When** each MCP tool invoked with valid Pro key
**Then** tool calls `ReportService` / `SearchService` methods matching REST equivalents (AD-1, FR-15)

**Given** `search_reports` with `query` + optional filters (status, project, since, cursor)
**When** executed
**Then** Postgres FTS via `SearchService.searchReports` returns ranked IDs + snippets (AD-7, FR-15)
**And** p95 latency < 2s for `get_report_summary` on Pro tier (SM-6)

**Given** tool parameter schemas
**When** documented
**Then** identical filter/cursor semantics as REST (FR-15 consequence)

**Given** replay manifest
**When** agent requests replay bytes via MCP
**Then** no tool exists in registry — presigned URLs never exposed via MCP (AD-6)

**Technical notes:** Build script `packages/contracts/scripts/validate-routes.ts` asserts MCP tool registration for each registry read entry. Queue `integrations` unrelated.

**Dependencies:** E5-S1, E6-S2.

---

## Story E5-S3: MCP parity contract tests (Streamable HTTP)

As a CI pipeline,
I want parity tests exercising real MCP Streamable HTTP against live app,
So that MCP and REST cannot diverge (AD-2, FR-18, board mandate).

**Acceptance Criteria:**

**Given** `packages/contracts/tests/parity.test.ts`
**When** test suite runs with Elysia app started
**Then** each read registry operation tested via:
- REST: live `fetch()` to `/api/v1/*` with Bearer fixtures
- MCP: Streamable HTTP client to `POST /mcp` with same keys
**And** assertions: field-equivalent payloads, auth scopes, error envelopes, Free-tier write rejection, filter params, cursor pagination (architecture §5.3)

**Given** test uses in-process handler calls only
**When** PR reviewed
**Then** rejected — must be real HTTP adapters wired (board mandate)

**Given** Free tier key
**When** write operation attempted (registry FF-1 entry skipped until E10)
**Then** `FORBIDDEN` on both transports

**Technical notes:** Turbo task `test:parity`. SM-2 counts READ tool calls at launch.

**Dependencies:** E5-S2, E6-S4.
