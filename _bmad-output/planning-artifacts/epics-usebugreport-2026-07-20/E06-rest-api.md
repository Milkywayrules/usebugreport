# Epic E6: REST API & Parity

**Goal:** Versioned REST at `/api/v1` through shared domain services with surface registry and real HTTP parity tests (LG-6).

**FRs:** FR-17, FR-18 | **ADs:** AD-1, AD-2

---

## Story E6-S1: Domain services and AD-1 lint gate

As a backend engineer,
I want ReportService and SearchService as sole business-logic owners,
So that REST and MCP never duplicate queries (FR-18, AD-1).

**Acceptance Criteria:**

**Given** `packages/services/src/report.ts` and `search.ts`
**When** methods `list`, `getById`, `getSummary`, `getConsoleLogs`, `getNetworkRequests`, `searchReports` implemented
**Then** each accepts `AuthContext` first argument with mandatory `organizationId` (AD-3)

**Given** CI lint on `apps/api/src/routes` and `apps/api/src/mcp`
**When** Drizzle imports or R2 client usage detected
**Then** build fails (AD-1, architecture §18 FR-18)

**Given** PR template
**When** developer submits route handler
**Then** checkbox confirms no inline DB queries (architecture §5.3)

**Technical notes:** Services depend on `packages/db`, `packages/storage` — not apps. Error envelope per architecture §12.

**Dependencies:** E2-S5.

---

## Story E6-S2: Surface registry and route validation

As an API consumer,
I want a single registry declaring REST paths, MCP tools, scopes,
So that parity is mechanically enforced (AD-2).

**Acceptance Criteria:**

**Given** `packages/contracts/src/surface-registry.ts` with entries for all v1 read operations (architecture §5.2)
**When** `packages/contracts/scripts/validate-routes.ts` runs at build
**Then** every entry has matching Elysia route in `apps/api/src/routes` and MCP tool in `apps/api/src/mcp`

**Given** registry entry shape
**When** inspected
**Then** fields include `{ id, service, method, rest, mcp, scopes }` (AD-2)

**Given** `comments.create` entry
**When** v1.0 build runs
**Then** entry marked `launchGate: false` — routes not required until E10 (architecture §5.2)

**Technical notes:** Zod schemas in `packages/contracts` feed `@elysiajs/swagger` OpenAPI at `GET /openapi.json` (FR-17).

**Dependencies:** E6-S1.

---

## Story E6-S3: REST report endpoints

As an API consumer,
I want GET endpoints for reports, summary, logs, network, and search,
So that agents can use REST instead of MCP (FR-17).

**Acceptance Criteria:**

**Given** Bearer `ubr_live_*` with `reports:read`
**When** calling:
- `GET /api/v1/reports` — cursor pagination
- `GET /api/v1/reports/:id`
- `GET /api/v1/reports/:id/summary`
- `GET /api/v1/reports/:id/console-logs`
- `GET /api/v1/reports/:id/network-requests`
- `GET /api/v1/reports/search?q=`
**Then** responses match MCP tool outputs field-for-field modulo transport envelope (FR-17, FR-18)

**Given** cursor pagination
**When** `?cursor=&limit=50` (max 100)
**Then** response `{ data, page: { nextCursor, hasMore } }` encodes `(created_at, id)` tuple (architecture §12)

**Given** OpenAPI published
**When** `GET /openapi.json`
**Then** Bearer auth documented; breaking change policy per PRD §10

**Technical notes:** Thin handlers in `apps/api/src/routes/reports/*.ts`. List p95 < 500ms for 50 items (PRD §8.1).

**Dependencies:** E6-S2, E4-S5.

---

## Story E6-S4: REST parity contract tests (real HTTP)

As a CI pipeline,
I want parity tests over live REST HTTP,
So that launch gate LG-6 is verifiable (AD-2, board mandate).

**Acceptance Criteria:**

**Given** `packages/contracts/tests/parity.test.ts`
**When** run via `turbo test:parity`
**Then** each registry read operation exercised with live `fetch()` to `/api/v1/*`
**And** tests cover: scopes, error envelopes (`UNAUTHORIZED`, `FORBIDDEN`, `QUOTA_EXCEEDED`), filter params, cursor pagination (architecture §5.3)

**Given** paired MCP tests (E5-S3)
**When** same fixtures used
**Then** REST and MCP payloads field-equivalent

**Technical notes:** Test Postgres via Docker. Not in-process Elysia `.handle()` shortcuts for parity assertions.

**Dependencies:** E6-S3.
