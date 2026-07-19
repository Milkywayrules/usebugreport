# Epic E2: Ingest Pipeline & Storage

**Goal:** Durable async ingest to R2 + Postgres with quotas, metadata/FTS, retention authority, and worker reliability (LG-1, LG-8, LG-11).

**FRs:** FR-4, FR-5, FR-7 | **ADs:** AD-4, AD-5, AD-6, AD-7, AD-9

---

## Story E2-S1: Core ingest schema and queue payloads

As a backend engineer,
I want Drizzle schema for reports, blobs, and usage plus BullMQ reference-only payloads,
So that ingest metadata persists without queue bloat (FR-5, AD-4).

**Acceptance Criteria:**

**Given** migration applied
**When** inspecting `packages/db/src/schema/`
**Then** tables exist: `reports` (with `ingest_status`, `idempotency_key`, `search_vector` generated column per architecture §3.3), `report_blobs`, `workspace_usage_monthly`
**And** unique index `(project_id, idempotency_key)` on `reports` (AD-5)

**Given** `packages/queue` job type definitions
**When** CI grep runs on queue payloads
**Then** no `Buffer`/`Uint8Array` in payload types — only `{ reportId, r2Keys[], projectId, idempotencyKey }` (system invariant)

**Technical notes:** `packages/db`, `packages/queue`. FTS GIN index `reports_search_vector_idx`. Status enum: `open`, `in_progress`, `resolved`, `closed`, `duplicate`.

**Dependencies:** E1-S1, E4-S1 (organizations/projects tables — minimal stub org/project seed in test DB acceptable if E4-S1 not merged; document coupling to E4-S3 for production).

---

## Story E2-S2: Presign and complete ingest path

As an SDK client,
I want presigned R2 PUT URLs after ingest-key auth,
So that large replay payloads upload directly to R2 (FR-1, FR-4, AD-4).

**Acceptance Criteria:**

**Given** valid `X-Ingest-Key: ubr_ingest_*` and `Idempotency-Key`
**When** `POST /api/v1/capture/presign` is called
**Then** `CaptureIngestService.presignUpload` validates key against `ingest_keys.key_hash`, checks project scope
**And** inserts or upserts `reports` row with `ingest_status=pending`
**And** returns `{ reportId, uploads[] }` with presigned PUT URLs from `packages/storage` R2 client

**Given** client finished R2 PUTs
**When** `POST /api/v1/capture/complete` with `{ reportId, r2Keys }`
**Then** service enqueues `ingest.finalize` on BullMQ `ingest` queue with refs only
**And** returns HTTP 202 `{ reportId, status: processing }` within 200ms p95 for enqueue-only work

**Given** invalid or revoked ingest key
**When** presign is called
**Then** HTTP 401 with error envelope `UNAUTHORIZED` (FR-4, architecture §12)

**Technical notes:** Routes in `apps/api/src/routes/capture/`. Service: `packages/services/src/ingest.ts`. Never write raw blobs to VPS disk (PRD FR-4 NFR).

**Dependencies:** E2-S1, E4-S3 (ingest_keys).

---

## Story E2-S3: Inline ingest path with ack latency measurement

As an SDK client with small payloads,
I want inline ingest that streams to R2 before HTTP ack,
So that small reports complete quickly without presign round-trips (AD-4).

**Acceptance Criteria:**

**Given** total body ≤ 1 MB
**When** `POST /api/v1/capture/ingest` is called with ingest key
**Then** `CaptureIngestService.acceptInlineIngest` streams body to R2 **before** HTTP response
**And** enqueues `ingest.finalize` with refs only
**And** returns HTTP 202

**Given** body > 1 MB
**When** inline ingest is attempted
**Then** HTTP 422 `VALIDATION_ERROR` directing client to presign path (architecture §4 payload caps)

**Given** production metrics enabled
**When** inline path runs under load test
**Then** p95 ack latency is measured and logged to `ubr_ingest_duration_seconds`
**And** if p95 exceeds 200ms, document relaxed inline-only p95 target in `packages/config` — durability (stream-before-ack) is never weakened (AD-4 board mandate)

**Technical notes:** Same route file as E2-S2. Integration test with mock R2 or MinIO. SM-5 tracks end-to-end ingest p95 separately in E2-S4 worker story.

**Dependencies:** E2-S2.

---

## Story E2-S4: ingest.finalize worker

As a platform operator,
I want the worker to validate R2 objects and write Postgres metadata,
So that reports become searchable and webhook-ready (FR-5, LG-1).

**Acceptance Criteria:**

**Given** `ingest.finalize` job `{ reportId, r2Keys[], projectId }`
**When** `apps/worker/src/jobs/ingest.ts` processes job
**Then** worker HEAD-validates each R2 key exists
**And** inserts `report_blobs` rows, updates derived summary JSONB and `summary_text` for FTS
**And** sets `reports.ingest_status=complete` and increments `workspace_usage_monthly.report_count` via `UsageService.increment` (AD-9)
**And** enqueues `webhooks.dispatch` for `report.created` (E8 dependency — job no-op if webhooks not registered)

**Given** duplicate `Idempotency-Key` retry
**When** finalize runs again
**Then** same `reportId` returned; no duplicate blob rows (AD-5)

**Given** typical 2-minute SPA payload on Pro tier
**When** measured end-to-end from SDK submit to `ingest_status=complete`
**Then** p95 < 5s (SM-5, FR-1)

**Technical notes:** `CaptureIngestService.processFinalizeJob`. Queue concurrency: 10 global, max 100 active per org (architecture §4). Worker container separate from API (architecture §16).

**Dependencies:** E2-S2, E2-S3.

---

## Story E2-S5: ReportService metadata reads and replay manifest

As a web or API consumer,
I want report metadata and presigned replay URLs,
So that the replay viewer loads blobs client-side without API proxy (FR-5, FR-6, AD-6).

**Acceptance Criteria:**

**Given** authenticated context with project access
**When** `ReportService.getById`, `getSummary`, `getConsoleLogs`, `getNetworkRequests` are called
**Then** every query includes `organization_id` from `AuthContext` (AD-3)
**And** `getReplayManifest(reportId)` returns presigned GET URLs (TTL 15 min) for `report_blobs.r2_key` rows
**And** presigned URLs are never returned via MCP tools or surface registry (AD-6)

**Given** `SearchService.searchReports`
**When** query string provided
**Then** uses `websearch_to_tsquery('english', q)` against `reports.search_vector` with GIN index (AD-7, FR-5)

**Technical notes:** `packages/services/src/report.ts`, `search.ts`. List API p95 < 500ms for 50 items (PRD §8.1) — index `reports_org_status_created_idx`.

**Dependencies:** E2-S4.

---

## Story E2-S6: Usage quotas and ingest rate limits

As a workspace on Free or Pro tier,
I want ingest blocked at quota with clear 429 responses,
So that tier limits are enforced at the boundary (FR-4, LG-8, AD-9, AD-11).

**Acceptance Criteria:**

**Given** Free tier workspace at 30 reports in calendar month
**When** presign or inline ingest is attempted
**Then** `UsageService.checkQuota` returns HTTP 429 `QUOTA_EXCEEDED` **before** enqueue (FR-4, PRD §9)

**Given** Pro tier at 2,000 reports in calendar month
**When** ingest attempted
**Then** HTTP 429 with `Retry-After` and fair-use message; existing reports unaffected (FR-4)

**Given** ingest key submitting > 10/min (burst 20)
**When** Redis sliding window exceeded
**Then** HTTP 429 `RATE_LIMITED` (FR-4)

**Given** 100 concurrent `ingest.finalize` jobs for one workspace
**When** new finalize job would enqueue
**Then** back-pressure applies per architecture §4 (BullMQ group limit)

**Technical notes:** `packages/services/src/usage.ts` — `checkQuota`, `checkTierLimit`, `increment`, `getMonthlyUsage`. Table `workspace_usage_monthly`. Increment on finalize completion only (AD-9).

**Dependencies:** E2-S4, E4-S6 (tier constants).

---

## Story E2-S7: Retention sweep and stale-pending cleanup

As a workspace admin,
I want tier-based blob expiry and orphan reconciliation,
So that storage costs align with billing tier (FR-7, LG-11).

**Acceptance Criteria:**

**Given** `report_blobs.expires_at` computed at ingest from org `billing_tier` (Free 7d replay/screenshot; Pro 30d/90d; Studio/Agency stub 90d)
**When** daily `retention.sweep` job runs in `apps/worker/src/jobs/retention.ts`
**Then** expired blobs are deleted from R2 and `report_blobs` rows removed (architecture §7 — single authority)
**And** Free tier metadata stub transition at 30 days clears blob refs, keeps summary (FR-7)

**Given** `reports WHERE ingest_status='pending'` older than 24h (presign without complete)
**When** sweep runs
**Then** report row deleted and best-effort orphan R2 objects removed (architecture §7 stale-pending mandate)

**Given** R2 keys under `{orgId}/` with no matching `report_blobs.r2_key` older than 24h
**When** orphan reconciliation runs
**Then** orphan keys deleted (architecture §7)

**Given** tier change on `organizations.billing_tier`
**When** `UsageService.recomputeRetention(orgId)` runs
**Then** all `report_blobs.expires_at` batch-updated per tier rules (never shorten below already-expired)

**Technical notes:** R2 lifecycle backstop: abort multipart 1 day; global 120-day catchall only — not per-tier replacement. Queue `retention` concurrency 1.

**Dependencies:** E2-S4, E4-S6.

---

## Story E2-S8: Worker container ops — memory, RSS concurrency, graceful shutdown

As a platform operator,
I want the worker container to respect memory limits and drain queues on shutdown,
So that ingest jobs are not lost during deploys (architecture §1).

**Acceptance Criteria:**

**Given** `docker-compose.prod.yml` worker service
**When** deployed on 12 GB VPS
**Then** worker memory limit 2 GB, reservation 1 GB (architecture §1 table)
**And** `WORKER_CONCURRENCY` default 8 with startup RSS probe halving concurrency if RSS > 70% of limit

**Given** `SIGTERM` during active jobs
**When** worker receives signal
**Then** stops accepting new jobs, calls `worker.close()` with 120s drain timeout, exits 0
**And** Coolify `stop_grace_period: 130s` documented in `docker/docker-compose.prod.yml`

**Given** worker health
**When** Redis or R2 unreachable
**Then** structured Pino logs include `traceId`, `organizationId`, `reportId` without logging `r2Key` or presigned URLs (system invariant)

**Technical notes:** `apps/worker/src/index.ts`. Bun + BullMQ 5.x. No in-process workers in API container (architecture §16 deviation).

**Dependencies:** E2-S4.
