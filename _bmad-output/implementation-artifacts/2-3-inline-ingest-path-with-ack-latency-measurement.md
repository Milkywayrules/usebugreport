---
baseline_commit: d3d6f673
depends_on:
  - 2-2-presign-and-complete-ingest-path
blocks:
  - 2-4-ingest-finalize-worker
  - 1-5-sdk-submit-widget-shadow-dom
---

# Story 2.3: Inline ingest path with ack latency measurement

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an SDK client with small payloads,
I want inline ingest that streams to R2 before HTTP ack,
so that small reports complete quickly without presign round-trips (AD-4).

## Acceptance Criteria

1. **Given** valid `X-Ingest-Key: ubr_ingest_*` and `Idempotency-Key` headers, **when** `POST /api/v1/capture/ingest` is called with `Content-Type: multipart/form-data` and total body ≤ **1 MB**, **then** `CaptureIngestService.acceptInlineIngest` upserts a `reports` row (`ingest_status=pending`), **streams every uploaded part to R2 before returning**, enqueues `ingest.finalize` with refs-only payload `{ reportId, r2Keys, projectId, idempotencyKey }`, **and** returns HTTP **202** `{ reportId, status: "processing", requestId }`.

2. **Given** request `Content-Length` or parsed multipart total exceeds **1 MB** (architecture §4 payload caps), **when** inline ingest is attempted, **then** HTTP **422** `VALIDATION_ERROR` with message directing client to presign path (`POST /api/v1/capture/presign` → R2 PUT → `/complete`); **and** no R2 objects are written and no queue job is enqueued.

3. **Given** duplicate `Idempotency-Key` for same `project_id`, **when** inline ingest is retried, **then** same `reportId` returned (AD-5 upsert); **and** idempotent retry does not duplicate R2 objects or enqueue duplicate finalize jobs when report is already `processing` or `complete` (return current status without re-upload if blobs already finalized — see Dev Notes idempotency branch).

4. **Given** invalid, revoked, or missing ingest key, **when** inline ingest is called, **then** HTTP **401** with error envelope `{ error: { code: "UNAUTHORIZED", message, requestId } }` (architecture §12).

5. **Given** inline ingest handler, **when** R2 keys are generated, **then** keys follow `{orgId}/{projectId}/{reportId}/...` layout via existing `buildIngestR2Key` (replay `batch-{seq}.json.gz`, `console.json.gz`, `network.json.gz`, `screenshot.webp`, `meta.json`); **and** keys are never logged (Pino redact invariant).

6. **Given** `CaptureIngestService.acceptInlineIngest`, **when** it runs, **then** no raw blob bytes are written to VPS disk or queued in BullMQ (AD-4 refs-only); **and** service method lives in `packages/services/src/ingest.ts` and is exported from `packages/services/src/index.ts`.

7. **Given** route registered in `apps/api/src/routes/capture/`, **when** mounted on Elysia app, **then** path is `POST /api/v1/capture/ingest` under same ingest-key middleware as presign/complete; **and** bypasses onboarding gate and session auth; **and** rejects non-multipart bodies with 422.

8. **Given** inline path completes, **when** handler finishes, **then** ack duration is measured (`performance.now()` from handler start through R2 upload + enqueue); **and** duration is recorded in Prometheus histogram `ubr_ingest_duration_seconds` with label `path=inline` (minimal implementation at `GET /metrics` acceptable — see Dev Notes metrics); **and** response may include `durationMs` for integration tests (mirror complete route pattern).

9. **Given** load test or integration test batch under realistic Frankfurt VPS → R2 latency, **when** inline p95 ack is computed, **then** if p95 exceeds **200ms**, document relaxed inline-only p95 target constant in `packages/config` (e.g. `INLINE_INGEST_ACK_P95_TARGET_MS`) — **durability (stream-to-R2-before-ack) is never weakened** (AD-4 board mandate, architecture §4 inline ack SLA).

10. **Given** `bun test` integration tests with Docker Postgres + Redis and mocked R2 `putObject`, **when** happy path runs, **then** multipart ingest → R2 put called for each part → Redis/BullMQ job with refs-only payload; **and** >1 MB body → 422; **and** revoked key → 401. Skip when `DATABASE_URL` or `REDIS_URL` unset.

11. **Out of scope for this story:** `ingest.finalize` worker processor (E2-S4); quota/rate limits before ingest (E2-S6); SDK HTTP wiring in `@usebugreport/browser` (E1-S5 — consumes this endpoint); `UsageService.checkQuota` hook (E2-S6 TODO); presign/complete behavior changes except shared helpers; full `@usebugreport/telemetry` package (infra-2 — use minimal local histogram stub); end-to-end SDK→worker p95 SM-5 (E2-S4).

## Tasks / Subtasks

- [x] Task 1 — R2 direct upload primitive (AC: 1, 5, 6)
  - [x] Extend `packages/storage/src/r2.ts` `R2Client` with `putObject(key, body, contentType)` using `@aws-sdk/client-s3` `PutObjectCommand` (accept `Uint8Array` / `Buffer` / `ReadableStream` — pick one Bun-friendly shape and document)
  - [x] Unit test in `packages/storage/src/r2.test.ts` with mocked S3 client (no live R2 required)
  - [x] Export unchanged public API surface from `packages/storage/src/index.ts`

- [x] Task 2 — Config constants for inline caps (AC: 2, 9)
  - [x] Add `packages/config/src/ingest.ts`: `INLINE_INGEST_MAX_BYTES = 1_048_576`, `INLINE_INGEST_ACK_P95_TARGET_MS = 200` (document in comment that target may be raised after measurement — never weaken stream-before-ack)
  - [x] Re-export from `packages/config/src/index.ts`

- [x] Task 3 — `acceptInlineIngest` service method (AC: 1, 2, 3, 5, 6)
  - [x] Extend `CaptureIngestServiceDeps.r2` to `Pick<R2Client, "presignPut" | "putObject">`
  - [x] Implement `acceptInlineIngest(ctx, input)` — parse validated parts, size-check, upsert report, `putObject` each part to R2 **before** enqueue, then `enqueueFinalize`
  - [x] Idempotency: reuse `findReportByIdempotency`; if existing report `ingest_status` is `processing` or `complete`, return `{ reportId, status }` without re-upload (optional: if `pending` from failed prior attempt, allow overwrite — document choice)
  - [x] Unit tests in `packages/services/src/ingest.test.ts` with mocked db/r2/queue

- [x] Task 4 — Multipart request parsing helper (AC: 1, 2, 7)
  - [x] Create `apps/api/src/routes/capture/parse-inline-ingest.ts` (or colocate in `index.ts` if small) — parse `multipart/form-data` via `request.formData()` with max size guard
  - [x] Map form fields to presign-equivalent parts: file fields `replay`, `console`, `network`, `meta`, `screenshot` (optional) + text fields `title`, `description`; replay supports `seq` via field name `replay` with optional `replaySeq` or single batch-0 for v1
  - [x] Reject empty parts array, unknown part names, missing required gzip/json content types

- [x] Task 5 — HTTP route (AC: 1, 4, 7, 8)
  - [x] Add `POST /api/v1/capture/ingest` in `apps/api/src/routes/capture/index.ts`
  - [x] Wire ingest-key + idempotency middleware (same as presign/complete)
  - [x] Measure `durationMs`; observe `ubr_ingest_duration_seconds{path="inline"}`

- [x] Task 6 — Metrics histogram stub (AC: 8, 9)
  - [x] Add minimal Prometheus histogram helper (e.g. `apps/api/src/lib/metrics.ts` or `packages/config/src/metrics.ts`) — `observeIngestDuration(path, seconds)`
  - [x] Expose at existing `GET /metrics` route (create if missing — architecture §11); label `path` ∈ `{ inline, complete }` (optional: add complete label in same PR for parity)
  - [x] Document measured p95 in story completion notes if integration test logs batch timings

- [x] Task 7 — Integration tests (AC: 10, 11)
  - [x] `apps/api/src/__tests__/capture-inline.integration.test.ts` — seed org/project/ingest key, multipart happy path, assert R2 mock puts + Redis job payload
  - [x] Test >1 MB → 422 with presign hint in message
  - [x] Test idempotency same reportId
  - [x] Test revoked key → 401

- [x] Task 8 — Verification gate (AC: all)
  - [x] Run full verification commands in Testing Requirements
  - [x] Confirm presign/complete integration tests still pass (no regressions)

## Dev Notes

### Goal

Queue position **#17** in sprint plan — second **HTTP ingest path** for small SDK payloads (≤1 MB). Delivers `POST /api/v1/capture/ingest`, `CaptureIngestService.acceptInlineIngest`, R2 stream-before-ack durability, ack latency measurement, and Prometheus hook. Unblocks E2-S4 (worker validates uploaded objects) and E1-S5 (SDK submit uses inline when payload small enough).

### Scope boundary (critical)

| In E2-S3 | Deferred |
| --- | --- |
| `POST /api/v1/capture/ingest` multipart handler | SDK client HTTP upload (E1-S5) |
| `CaptureIngestService.acceptInlineIngest` | Worker `processFinalizeJob` (E2-S4) |
| R2 `putObject` direct upload | Quota/rate limits (E2-S6) |
| 1 MB cap enforcement + 422 presign redirect | Usage increment (E2-S4 finalize) |
| `ubr_ingest_duration_seconds` histogram (inline) | Full telemetry package refactor (infra-2) |
| Config constants for cap + relaxed p95 target | End-to-end ingest p95 SM-5 (E2-S4) |

**E2-S2 handoff:** Presign + complete path merged on main (`d3d6f673`). Reuse `buildIngestR2Key`, `findReportByIdempotency` pattern, ingest-key middleware, queue enqueue, error envelopes. **Do not break** presign/complete tests.

### Current repo state (modify / extend)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/services/src/ingest.ts` | `presignUpload`, `completeIngest` only | **Add** `acceptInlineIngest`; extend `CaptureIngestServiceDeps.r2` |
| `packages/services/src/ingest.test.ts` | presign/complete unit tests | **Add** inline tests with mocked `putObject` |
| `packages/storage/src/r2.ts` | `presignPut`, `presignGet` only | **Add** `putObject` |
| `packages/config/src/index.ts` | tiers + env | **Add** ingest cap constants export |
| `apps/api/src/routes/capture/index.ts` | presign + complete routes | **Add** `/ingest` route |
| `apps/api/src/middleware/ingest-key-auth.ts` | X-Ingest-Key + Idempotency-Key | **Reuse** unchanged |
| `apps/api/src/__tests__/capture-presign.integration.test.ts` | presign→complete | **Must still pass** — no regressions |
| `apps/worker/src/index.ts` | Stub boot | **Unchanged** (no processor) |
| `GET /metrics` | Tagged excluded in OpenAPI; may not exist yet | **Add or extend** histogram export |

**Do not touch:** Web app shell, `@usebugreport/browser` SDK submit (E1-S5), `_bmad-output/` except this file + sprint-status.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| §4 Ingest Pipeline | Inline: validate → insert report → **stream to R2 before ack** → enqueue finalize → 202 |
| §4 Endpoints | `POST /api/v1/capture/ingest`; auth = ingest key |
| §4 Payload caps | Inline total **1 MB** hard reject → presign path |
| §4 Inline ack SLA | Measure p95; relax inline-only target in config if R2 RTT breaks 200ms — **never** ack before R2 durable write |
| §4 Queues | Job `ingest.finalize` refs-only — same schema as presign complete |
| §7 R2 key layout | Reuse `buildIngestR2Key` — do not invent alternate paths |
| §11 Metrics | `ubr_ingest_duration_seconds` histogram |
| §12 Errors | 401 `UNAUTHORIZED`, 422 `VALIDATION_ERROR`, 202 on success |
| AD-4 | R2-first; stream-before-ack; BullMQ refs only |
| AD-5 | Idempotent inline returns same `reportId` |
| ARCHITECTURE-SPINE AD-4 | Inline ≤1 MB; measure ack; durability never weakened |

### Inline request contract (implementer spec)

**Endpoint:** `POST /api/v1/capture/ingest`

**Headers (required):**

- `X-Ingest-Key: ubr_ingest_*`
- `Idempotency-Key: <uuid>`
- `Content-Type: multipart/form-data`

**Form fields:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | text | no | Default `"Untitled report"` |
| `description` | text | no | |
| `replay` | file | yes* | `application/gzip`; v1 single batch seq 0 |
| `replaySeq` | text | no | Default `0` if replay present |
| `console` | file | yes* | `application/gzip` |
| `network` | file | yes* | `application/gzip` |
| `meta` | file | yes* | `application/json` |
| `screenshot` | file | no | `image/webp` |

\*At minimum `meta` + one content part required for a valid report; mirror presign `parts` validation — **require same part set as typical SDK submit** (replay, console, network, meta; screenshot optional). Align error messages with presign validation tone.

**Size guard:** Sum of all part file sizes + form overhead must be ≤ `INLINE_INGEST_MAX_BYTES`. Check `Content-Length` early when present; otherwise accumulate during `formData()` parse and abort with 422 if exceeded.

**Response 202:**

```json
{
  "reportId": "rpt_...",
  "status": "processing",
  "requestId": "req_...",
  "durationMs": 142
}
```

**Response 422 (>1 MB or invalid multipart):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Inline ingest limited to 1 MB; use POST /api/v1/capture/presign for larger payloads.",
    "requestId": "req_..."
  }
}
```

**E1-S5 SDK alignment:** `@usebugreport/browser` `submit()` will build `FormData` from `CaptureSubmitPayload.parts` — field names above must match what E1-S5 will send (document in completion notes if adjusted).

### `acceptInlineIngest` design

```typescript
// packages/services/src/ingest.ts — illustrative
export interface InlineIngestPart {
  name: IngestPartName;
  contentType: string;
  body: Uint8Array; // or Buffer
  seq?: number;
}

export interface InlineIngestInput {
  description?: string;
  parts: InlineIngestPart[];
  title?: string;
}

// Inside createCaptureIngestService:
async acceptInlineIngest(ctx: CaptureIngestContext, input: InlineIngestInput) {
  const totalBytes = input.parts.reduce((n, p) => n + p.body.byteLength, 0);
  if (totalBytes > INLINE_INGEST_MAX_BYTES) {
    throw new ServiceError("VALIDATION_ERROR", "Inline ingest limited to 1 MB; use presign path.");
  }
  // upsert report (same as presignUpload idempotency)
  const r2Keys: string[] = [];
  for (const part of input.parts) {
    const key = buildIngestR2Key(ctx.organizationId, ctx.projectId, reportId, part);
    await deps.r2.putObject(key, part.body, part.contentType); // BEFORE enqueue
    r2Keys.push(key);
  }
  await deps.enqueueFinalize({ reportId, r2Keys, projectId: ctx.projectId, idempotencyKey: ctx.idempotencyKey });
  return { reportId, status: "processing" as const };
}
```

**Critical ordering:** All `putObject` calls complete **before** `enqueueFinalize` **before** HTTP 202. Worker HEAD-validates in E2-S4.

### Idempotency edge cases

| Existing `ingest_status` | Retry behavior |
| --- | --- |
| `pending` (same idempotency key) | Same `reportId`; re-upload parts + re-enqueue acceptable OR short-circuit if prior upload succeeded — pick one, test it |
| `processing` / `complete` | Return `{ reportId, status: current }` without re-upload/re-enqueue |
| New key | New report row |

Matches AD-5 spirit: SDK retries must not create duplicate reports.

### R2 `putObject` extension

```typescript
// packages/storage/src/r2.ts
putObject: (
  key: string,
  body: Uint8Array | Buffer,
  contentType: string
) => Promise<void>;
```

Use same S3 client + bucket as presign. Do not log `key` on success/error (redact). Integration tests inject mock that records `{ key, size, contentType }` calls.

### Metrics (minimal v1 — infra-2 deferred)

Architecture §11 requires `ubr_ingest_duration_seconds` histogram. infra-2 will centralize telemetry later; **this story** adds:

1. `observeIngestDuration("inline", durationMs / 1000)` at end of handler
2. Prometheus text at `GET /metrics` (internal route — already excluded from public OpenAPI per infra-1)
3. Constant `INLINE_INGEST_ACK_P95_TARGET_MS` in `packages/config` — default **200**; raise (e.g. 500) only after documented measurement if Frankfurt→R2 p95 exceeds 200ms

**Load test guidance:** Integration test can fire N sequential inline ingests with mocked R2 latency (e.g. 50ms simulated delay) and assert p95 `< INLINE_INGEST_ACK_P95_TARGET_MS`. Real R2 optional in CI.

Complete route already returns `durationMs` — optionally add `path=complete` histogram observation in same PR for consistency (not required AC).

### Previous story intelligence

**From E2-S2 (2-2-presign-and-complete-ingest-path.md):**

- `X-Ingest-Key` header (not Bearer) for capture routes
- `requireIngestKeyAuth` + `requireIdempotencyKey` middleware patterns
- `completeIngest` sets `ingest_status=processing` before enqueue
- Integration test pattern: docker postgres + redis, truncate cascade, seed ingest key via project API
- `@usebugreport/web#build` Mantine prerender failure pre-existing — out of scope
- Queue: `createQueue(QUEUE_NAMES.INGEST)` + `ingestFinalizePayloadSchema`

**From E2-S1 (2-1-core-ingest-schema-and-queue-payloads.md):**

- Queue invariant: no Buffer in payloads — CI test `payload-invariant.test.ts`
- `reports` unique `(project_id, idempotency_key)`

**From E1-S3 (1-3-screenshot-and-environment-metadata-at-submit.md):**

- `CaptureSubmitPayload.parts` shape: replay (gzip batch-0), console, network, meta (json), screenshot (webp optional)
- Logical part names map to R2 keys via `buildIngestR2Key`

**From infra-1:**

- Do not create `@usebugreport/telemetry` package in this story
- `/metrics` excluded from public OpenAPI — internal histogram OK

### Anti-patterns (do NOT)

- Do not ack HTTP 202 before all R2 `putObject` calls succeed
- Do not enqueue blob bytes in BullMQ
- Do not write uploads to VPS disk (stream/memory only)
- Do not weaken 1 MB cap or skip size check
- Do not log r2 keys or presigned URLs
- Do not require session cookie on capture routes
- Do not implement finalize worker logic in API handler
- Do not break presign/complete routes or tests

### Git intelligence (HEAD `d3d6f673`)

Main includes merged presign/complete ingest (`feat/presign-ingest`), web shell, E4 auth/RBAC, E2-S1 schema. Inline path completes the dual-path ingest API surface from architecture §4.

### Project Structure Notes

New files (expected):

```text
packages/config/src/ingest.ts
packages/storage/src/r2.test.ts          # if not exists
apps/api/src/routes/capture/parse-inline-ingest.ts   # optional split
apps/api/src/__tests__/capture-inline.integration.test.ts
apps/api/src/lib/metrics.ts              # if metrics route missing
```

Modified:

```text
packages/services/src/ingest.ts
packages/services/src/ingest.test.ts
packages/services/src/index.ts           # only if new exports needed
packages/storage/src/r2.ts
packages/storage/src/index.ts
packages/config/src/index.ts
apps/api/src/routes/capture/index.ts
apps/api/src/index.ts                    # wire metrics route if new
```

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E02-ingest-pipeline-storage.md#Story E2-S3]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§4 Ingest Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§4 Payload caps]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§11 Observability]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-4]
- [Source: _bmad-output/implementation-artifacts/2-2-presign-and-complete-ingest-path.md]
- [Source: _bmad-output/implementation-artifacts/2-1-core-ingest-schema-and-queue-payloads.md]
- [Source: _bmad-output/implementation-artifacts/1-3-screenshot-and-environment-metadata-at-submit.md]
- [Source: packages/services/src/ingest.ts — presignUpload, completeIngest, buildIngestR2Key]
- [Source: packages/storage/src/r2.ts — presignPut]
- [Source: packages/capture-core/src/submit-payload.ts — CaptureSubmitPayload.parts]
- [Source: apps/api/src/routes/capture/index.ts — presign/complete handlers]

## Testing Requirements

Run from repo root; all must exit 0:

```bash
# Prerequisites
docker compose -f docker/docker-compose.dev.yml up -d postgres redis
export DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:5432/usebugreport
export REDIS_URL=redis://localhost:6379

bun install
bun run db:migrate
bunx biome check .
bunx turbo run lint typecheck test build

# Focused tests
DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" bun test packages/services/src/ingest.test.ts
DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" bun test apps/api/src/__tests__/capture-inline.integration.test.ts
DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" bun test apps/api/src/__tests__/capture-presign.integration.test.ts
bun test packages/queue/src/__tests__/payload-invariant.test.ts
bun test packages/storage/src/r2.test.ts
```

| Case | Expected |
| --- | --- |
| Valid ingest key + multipart ≤1 MB → ingest | 202 processing; R2 putObject per part; Redis job refs-only |
| Body > 1 MB | 422 VALIDATION_ERROR; presign path hint |
| Same idempotency retry (complete report) | Same reportId; no duplicate enqueue |
| Revoked / wrong key | 401 UNAUTHORIZED |
| Missing Idempotency-Key | 422 |
| Queue payload | Passes `ingestFinalizePayloadSchema`; no binary fields |
| Presign/complete regression | Existing integration tests still pass |
| Metrics | `GET /metrics` includes `ubr_ingest_duration_seconds` bucket (after inline request) |

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented `POST /api/v1/capture/ingest` multipart route with `parse: "none"`, ingest-key auth, ack `durationMs`, and `ubr_ingest_duration_seconds{path="inline"}` histogram at `GET /metrics`.
- `acceptInlineIngest` streams all parts to R2 before enqueue; BullMQ job dedup via `jobId`; conditional `pending→processing` claim reduces duplicate finalize jobs.
- Idempotency: `processing`/`complete` returns current status without re-upload; `pending` retries re-upload and re-enqueue.
- Integration tests mock `@usebugreport/storage`; mocked-R2 inline ack p95 in CI ≪ `INLINE_INGEST_ACK_P95_TARGET_MS` (200ms). Form field names align with future E1-S5 SDK `FormData` contract.

### File List

- `packages/config/src/ingest.ts`
- `packages/config/src/index.ts`
- `packages/storage/src/r2.ts`
- `packages/storage/src/index.ts`
- `packages/storage/src/__tests__/r2.test.ts`
- `packages/services/src/ingest.ts`
- `packages/services/src/ingest.test.ts`
- `packages/services/src/index.ts`
- `apps/api/src/lib/metrics.ts`
- `apps/api/src/routes/capture/parse-inline-ingest.ts`
- `apps/api/src/routes/capture/index.ts`
- `apps/api/src/index.ts`
- `apps/api/src/__tests__/capture-inline.integration.test.ts`

### Change Log

- 2026-07-20: E2-S3 inline ingest path — R2 putObject, multipart route, metrics histogram, integration tests.
