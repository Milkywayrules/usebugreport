---
name: usebugreport
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: layered monolith — transport adapters over shared domain services
scope: usebugreport v1.0 platform (E1–E11 epics, LG-1..LG-11)
status: final
created: 2026-07-20
updated: 2026-07-20
binds: [FR-1..FR-26, LG-1..LG-11, E1..E11]
sources:
  - prds/prd-usebugreport-2026-07-20/prd.md
  - ux-usebugreport-2026-07-20/EXPERIENCE.md
  - research/technical-usebugreport-platform-architecture-research-2026-07-20.md
companions:
  - architecture.md
---

# Architecture Spine — usebugreport

## Design Paradigm

**Layered monolith with shared domain services.** One Bun process model split into three deployable containers (`api`, `worker`, `web`) sharing packages. Business logic lives exclusively in `packages/services`; REST (`apps/api/src/routes`), MCP (`apps/api/src/mcp`), and BullMQ workers (`apps/worker`) are thin adapters. Postgres is system of record; R2 is blob store; Redis is queue + rate-limit state.

```mermaid
flowchart TB
  subgraph transport [Transport Adapters]
    REST["REST /api/v1"]
    MCP["MCP /mcp"]
    ING["Ingest /capture/*"]
    WH["Webhook outbound"]
  end
  subgraph domain [packages/services]
    RS[ReportService]
    CIS[CaptureIngestService]
    SS[SearchService]
    CS[CommentService]
    IS[IntegrationService]
    WS[WebhookService]
    DS[DeletionService]
    US[UsageService]
  end
  subgraph data [Data Access]
    DB["packages/db Drizzle"]
    R2["packages/storage R2 client"]
    Q["packages/queue BullMQ"]
  end
  REST --> RS & SS & CS & IS & WS
  MCP --> RS & SS
  ING --> CIS
  WH --> WS
  CIS --> Q
  RS & SS & CS & IS & WS & DS & US --> DB
  CIS & DS --> R2
  CIS & DS & WS --> Q
```

## Invariants & Rules

### AD-1 — Shared service layer is sole business-logic owner

- **Binds:** FR-17, FR-18, LG-6, E5, E6
- **Prevents:** MCP and REST diverging on filters, pagination, or field shapes
- **Rule:** All report/search/comment/ingest/integration logic lives in `packages/services`. Route and MCP handlers call service methods only. CI fails if `apps/api/src/mcp` or `apps/api/src/routes` contain Drizzle queries or R2 calls.

### AD-2 — REST/MCP parity via surface registry + contract tests

- **Binds:** FR-15, FR-17, FR-18, LG-5, LG-6
- **Prevents:** Tool added to MCP without REST equivalent (or vice versa)
- **Rule:** `packages/contracts/src/surface-registry.ts` declares each operation once: `{ id, service, method, restPath, restMethod, mcpTool, scopes }`. REST routes and MCP tools are generated or validated from this registry at build time. `packages/contracts/tests/parity.test.ts` invokes each operation through both transports with identical inputs and asserts field-equivalent outputs.

### AD-3 — Tenancy scoping on every mutation and query

- **Binds:** FR-8, FR-9, FR-14, FR-22
- **Prevents:** Cross-workspace data leaks via API key or session
- **Rule:** Every service method accepts `AuthContext { type, organizationId, userId?, apiKeyId?, projectIds? }` as first argument. Middleware in `apps/api/src/middleware/auth.ts` resolves context; services reject when `organizationId` cannot be derived. Project-scoped reads check `project_members` unless caller is org owner/admin.

### AD-4 — Ingest never blocks on blob I/O

- **Binds:** FR-1, FR-4, LG-1, LG-8, E2
- **Prevents:** VPS disk exhaustion and ingest timeouts under load
- **Rule:** `POST /api/v1/capture/ingest` validates ingest key, quota, rate limits → enqueues `ingest.process` BullMQ job → returns `202` with `reportId` within 200ms p95. Worker writes gzip batches to R2, then updates Postgres. Raw blobs never touch VPS disk except streaming pass-through to R2 multipart.

### AD-5 — Idempotent ingest and webhook side effects

- **Binds:** FR-4, FR-19, FR-21
- **Prevents:** Duplicate reports and duplicate Linear issues on retry
- **Rule:** SDK sends `Idempotency-Key` (or `ingestId` in body). `CaptureIngestService` upserts on `(project_id, idempotency_key)`. Linear push stores `linear_issue_id` on report; second push returns existing URL.

### AD-6 — Blob access via short-lived R2 presigned URLs

- **Binds:** FR-6, FR-7
- **Prevents:** API server streaming multi-MB replays through VPS bandwidth
- **Rule:** `ReportService.getReplayManifest(reportId)` returns presigned GET URLs (TTL 15 min) for `report_blobs.r2_key` rows. Web app and MCP tools fetch blobs client-side or return URLs in tool results. No proxy-through-api for replay bytes.

### AD-7 — Postgres FTS for v1 search

- **Binds:** FR-5, FR-15, LG-5
- **Prevents:** Premature vector/semantic search infrastructure
- **Rule:** `reports.search_vector` is a generated `tsvector` from `title`, `description`, `summary_text`. `SearchService.searchReports` uses `websearch_to_tsquery('english', q)` with GIN index. No Elasticsearch/OpenSearch in v1.

### AD-8 — GDPR cascade as durable deletion job

- **Binds:** FR-10, LG-7, E9
- **Prevents:** Orphan R2 objects and partial deletes
- **Rule:** `DeletionService.enqueueWorkspaceDeletion(orgId)` creates `deletion_jobs` row, revokes keys immediately, enqueues ordered BullMQ steps: `deletion.r2_purge` → `deletion.postgres_purge` → `deletion.redis_purge` → `deletion.audit_complete`. p95 SLA 72h; owner emailed on terminal state.

### AD-9 — Usage and rate limits enforced at ingest boundary

- **Binds:** FR-4, LG-8
- **Prevents:** Free tier overage and Pro fair-use collapse
- **Rule:** `workspace_usage_monthly(organization_id, year_month, report_count)` incremented atomically on successful ingest job completion. Free hard cap 30 → HTTP 429 before enqueue. Pro soft cap 2000 → HTTP 429 with `Retry-After`. Per-ingest-key Redis sliding window: 10/min, burst 20. Max 100 concurrent `ingest.process` jobs per workspace (BullMQ group concurrency).

### AD-10 — Keyboard shortcut single registry

- **Binds:** FR-11, FR-12, FR-13, LG-9, E3
- **Prevents:** Palette and `useHotkeys` drift
- **Rule:** `apps/web/src/keyboard/shortcuts.ts` exports `SHORTCUTS` map consumed by `@mantine/spotlight` actions and `useHotkeys` hooks. No ad-hoc key listeners outside this module.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| IDs | `org_*`, `prj_*`, `rpt_*`, `cmt_*`, `whk_*`; UUIDv7 internally, prefixed external IDs |
| Timestamps | ISO 8601 UTC in API; `timestamptz` in Postgres |
| Error envelope | `{ error: { code, message, details?, requestId } }` — codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `VALIDATION_ERROR`, `INTERNAL` |
| Pagination | Cursor-based: `?cursor=&limit=50` (max 100); response `{ data, page: { nextCursor, hasMore } }` |
| Auth headers | Session cookie (web); `Authorization: Bearer ubr_live_*` (API/MCP); ingest: `X-Ingest-Key: ubr_ingest_*` or body `projectKey` |
| Logging | JSON structured: `{ level, msg, traceId, organizationId, reportId, userId }` |
| Secrets | Env vars only; OAuth tokens encrypted with `ENCRYPTION_KEY` in `integrations.oauth_tokens_encrypted` |

## Stack

| Name | Version |
| --- | --- |
| Bun | 1.2.x |
| turborepo | 2.x |
| Next.js (App Router) | 15.x |
| Mantine | 7.x |
| TanStack Query / Table | 5.x |
| ElysiaJS | 1.x |
| @elysiajs/swagger | 1.x |
| better-auth | 1.x (organization, apiKey, bearer plugins) |
| PostgreSQL | 16.x |
| Drizzle ORM | 0.38+ |
| Redis | 7.x |
| BullMQ | 5.x |
| @aws-sdk/client-s3 (R2) | 3.x |
| @modelcontextprotocol/sdk | 1.x (pinned until v2 GA) |
| rrweb + official plugins | 2.x |
| bun test | built-in |
| Playwright | 1.x |

## Structural Seed

```text
usebugreport/
  apps/
    web/                 # Next.js App Router, Mantine, TanStack Query
    api/                 # Elysia: REST, MCP, auth, ingest endpoints
    worker/              # BullMQ consumers (ingest, webhooks, deletion, retention)
  packages/
    db/                  # Drizzle schema, migrations, client
    contracts/           # Zod schemas, surface-registry, OpenAPI types
    config/              # Shared env validation, constants
    services/            # Domain services (ReportService, etc.)
    storage/             # R2 S3 client helpers
    queue/               # BullMQ queue definitions, job payloads
    capture-core/        # rrweb record, plugins, buffer, privacy
    sdk/                 # @usebugreport/browser publishable package
  docker/
    docker-compose.prod.yml
  turbo.json
```

## Capability → Architecture Map

| Capability / Epic | Lives in | Governed by |
| --- | --- | --- |
| E1 Capture SDK | `packages/capture-core`, `packages/sdk` | AD-4, AD-5 |
| E2 Ingest & storage | `CaptureIngestService`, `apps/worker/ingest` | AD-4, AD-6, AD-9 |
| E3 Web app | `apps/web` | AD-10 |
| E4 Auth & RBAC | `apps/api/middleware`, better-auth, `project_members` | AD-3 |
| E5 MCP | `apps/api/src/mcp` | AD-1, AD-2 |
| E6 REST | `apps/api/src/routes` | AD-1, AD-2 |
| E7 Linear | `IntegrationService` | AD-5 |
| E8 Webhooks | `WebhookService`, `apps/worker/webhooks` | AD-5 |
| E9 GDPR | `DeletionService`, `apps/worker/deletion` | AD-8 |
| E10 create_comment (FF-1) | `CommentService` | AD-1, AD-2 |
| E11 v1.1 integrations | deferred | Deferred |

## Deferred

| Item | Revisit when |
| --- | --- |
| Semantic/vector search | Postgres FTS insufficient at scale |
| Chrome extension (`capture-extension`) | v2.0 epic |
| Multi-region / edge API | Post-100 paying workspaces or EU residency mandate |
| Real-time report list updates | v1.5 optional Redis pub/sub |
| `@elysiajs/bullmq` in-process workers | Worker container proven insufficient |
| Studio tier bi-directional sync | Studio GA pricing |
