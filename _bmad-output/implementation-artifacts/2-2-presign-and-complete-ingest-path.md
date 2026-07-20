---
baseline_commit: a2d6313
depends_on:
  - 2-1-core-ingest-schema-and-queue-payloads
  - 4-3-workspace-and-project-crud-with-ingest-keys
blocks:
  - 2-3-inline-ingest-path-with-ack-latency-measurement
  - 2-4-ingest-finalize-worker
  - 1-5-sdk-submit-widget-shadow-dom
---

# Story 2.2: Presign and complete ingest path

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an SDK client,
I want presigned R2 PUT URLs after ingest-key auth,
so that large replay payloads upload directly to R2 (FR-1, FR-4, AD-4).

## Acceptance Criteria

1. **Given** valid `X-Ingest-Key: ubr_ingest_*` header and `Idempotency-Key` header (UUID), **when** `POST /api/v1/capture/presign` is called with JSON body describing upload parts (see Dev Notes), **then** `CaptureIngestService.presignUpload` validates key via `ProjectService.validateIngestKey`, checks project scope, **and** inserts or upserts `reports` row with `ingest_status=pending`, **and** returns HTTP **200** `{ reportId, uploads: [{ key, url, contentType, part }] }` with presigned PUT URLs from `@usebugreport/storage` R2 client.

2. **Given** client finished R2 PUTs, **when** `POST /api/v1/capture/complete` with JSON `{ reportId, r2Keys: string[] }` and same ingest key + idempotency headers, **then** service validates report belongs to key's project, **and** enqueues `ingest.finalize` on BullMQ `ingest` queue with refs-only payload `{ reportId, r2Keys, projectId, idempotencyKey }`, **and** returns HTTP **202** `{ reportId, status: "processing" }` within **200ms p95** for enqueue-only work (measure in integration test or log timing — no worker processor required this story).

3. **Given** duplicate `Idempotency-Key` for same `project_id`, **when** presign is retried, **then** same `reportId` returned (upsert / unique index AD-5); **and** `ingest_status` reflects current state (pending if not yet completed).

4. **Given** invalid, revoked, or missing ingest key, **when** presign or complete is called, **then** HTTP **401** with error envelope `{ error: { code: "UNAUTHORIZED", message, requestId } }` per architecture §12 (FR-4).

5. **Given** ingest key on non-capture route (e.g. `GET /api/v1/projects`), **when** only `X-Ingest-Key` provided (no session), **then** HTTP **401** — ingest keys scoped to `/api/v1/capture/*` only (architecture §6, existing `api-key-auth.ts` pattern rejects ingest bearer on v1 routes).

6. **Given** presign response, **when** R2 keys are generated, **then** keys follow layout `{orgId}/{projectId}/{reportId}/{part}/...` per architecture §7 (e.g. `replay/batch-0.json.gz`, `console.json.gz`, `network.json.gz`, `screenshot.webp`, `meta.json`); **and** keys are never logged (system invariant — Pino redact).

7. **Given** `CaptureIngestService` implementation, **when** presign/complete runs, **then** no raw blob bytes written to VPS disk or queued in BullMQ (AD-4, ARCHITECTURE-SPINE refs-only); **and** service lives in `packages/services/src/ingest.ts` exported from `packages/services/src/index.ts`.

8. **Given** routes in `apps/api/src/routes/capture/`, **when** registered on Elysia app, **then** mounted under `/api/v1/capture/*`; **and** bypass onboarding gate (ingest is SDK/project-key auth, not session); **and** bypass session middleware requirement; **and** use dedicated ingest-key middleware reading `X-Ingest-Key` header (ARCHITECTURE-SPINE — not `Authorization: Bearer` for capture routes).

9. **Given** `bun test` integration tests with Docker Postgres + Redis (`DATABASE_URL`, `REDIS_URL`), **when** happy path runs with mocked or MinIO R2 (unit-mock presigner acceptable), **then** presign → complete enqueues job visible in Redis/BullMQ with refs-only payload validated by `ingestFinalizePayloadSchema`; **and** revoked key → 401 on presign.

10. **Out of scope for this story:** inline ingest `POST /api/v1/capture/ingest` (E2-S3); `ingest.finalize` worker processor (E2-S4); quota/rate limits (E2-S6); SDK HTTP upload wiring in `@usebugreport/browser` (E1-S5); `UsageService.checkQuota` before presign (E2-S6 — document TODO hook); multipart upload >5 MB (use single PUT presign per part for v1); webhook dispatch on complete (worker E2-S4).

## Tasks / Subtasks

- [x] Task 1 — Ingest key middleware (AC: 4, 5, 8)
  - [x] Create `apps/api/src/middleware/ingest-key-auth.ts` — parse `X-Ingest-Key`, call `projectService.validateIngestKey`, attach `{ organizationId, projectId }` to context; 401 envelope on failure
  - [x] Ensure capture routes skip `onboardingGateMiddleware` and session requirement (register capture plugin before gate or exclude path prefix)
  - [x] Add CORS allowed header `X-Ingest-Key`, `Idempotency-Key` in `apps/api/src/index.ts`

- [x] Task 2 — CaptureIngestService (AC: 1, 2, 3, 6, 7)
  - [x] Create `packages/services/src/ingest.ts` with `createCaptureIngestService(db, deps)` factory
  - [x] `presignUpload(ctx, { idempotencyKey, parts })` — validate key scope, upsert report (`rpt_*` id), generate R2 keys, return presigned PUT URLs via injected `r2.presignPut`
  - [x] `completeIngest(ctx, { reportId, r2Keys })` — verify report pending + project match, set `ingest_status=processing` (optional), enqueue `ingest.finalize`, return processing status
  - [x] Idempotency: on conflict `(project_id, idempotency_key)` return existing report
  - [x] Export from `packages/services/src/index.ts`
  - [x] Unit tests `packages/services/src/ingest.test.ts` with mocked db/queue/r2

- [x] Task 3 — Capture HTTP routes (AC: 1, 2, 8)
  - [x] Create `apps/api/src/routes/capture/presign.ts` + `complete.ts` or single `index.ts` registering both
  - [x] Zod request bodies in route or `packages/contracts` — document expected presign body: `{ title?, description?, parts: [{ name: 'replay'|'console'|'network'|'screenshot'|'meta', contentType, seq? }] }`
  - [x] Wire into `apps/api/src/index.ts` via `registerCaptureRoutes(app, deps)`
  - [x] OpenAPI tags for capture routes (internal/public filter per infra-1)

- [x] Task 4 — Queue enqueue (AC: 2, 7)
  - [x] Use `createQueue(JOB_NAMES.INGEST_FINALIZE)` from `@usebugreport/queue` — queue name `ingest`, job name `ingest.finalize`
  - [x] Validate payload with `ingestFinalizePayloadSchema` before add
  - [x] Inject queue into service deps for testability

- [x] Task 5 — Integration tests (AC: 9, 10)
  - [x] `apps/api/src/__tests__/capture-presign.integration.test.ts` — seed org/project/ingest key, presign 200, complete 202, assert DB report row + Redis job
  - [x] Test revoked key after rotate → 401
  - [x] Test idempotency retry returns same reportId
  - [x] Skip when `DATABASE_URL` or `REDIS_URL` unset

- [x] Task 6 — Verification gate (AC: all)
  - [x] Run full verification commands in Testing Requirements
  - [x] Confirm `apps/worker` still has no finalize processor (E2-S4)

## Dev Notes

### Goal

Queue position **#16** in sprint plan — first **HTTP ingest path** for large SDK payloads. Delivers presign + complete endpoints, `CaptureIngestService`, ingest-key auth, and BullMQ enqueue. Unblocks E2-S3 (inline), E2-S4 (worker), E1-S5 (SDK upload widget).

### Scope boundary (critical)

| In E2-S2 | Deferred |
| --- | --- |
| `POST /api/v1/capture/presign` | `POST /api/v1/capture/ingest` inline (E2-S3) |
| `POST /api/v1/capture/complete` | Worker `processFinalizeJob` (E2-S4) |
| `CaptureIngestService.presignUpload`, `completeIngest` | `acceptInlineIngest` (E2-S3) |
| Ingest-key middleware (`X-Ingest-Key`) | Quota/rate limits (E2-S6) |
| BullMQ enqueue refs-only | Usage increment (E2-S4 finalize) |
| R2 presigned PUT URLs | SDK client HTTP upload (E1-S5) |

**E4-S3 handoff:** `ProjectService.validateIngestKey(plaintext)` already implemented — **reuse**, do not re-hash. Rotation revokes old key immediately (integration test in E4-S3).

**E2-S1 handoff:** Schema, queue payloads, R2 client exist — this story adds service + routes only.

### Current repo state (modify / extend)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/services/src/ingest.ts` | **Missing** | **Create** CaptureIngestService |
| `packages/services/src/index.ts` | No ingest export | Export ingest service |
| `packages/services/src/project.ts` | `validateIngestKey` ready | **Reuse** from middleware/service |
| `packages/storage/src/r2.ts` | `presignPut` / `presignGet` | **Use** in ingest service |
| `packages/queue/src/payloads/ingest.ts` | Zod schema defined | **Use** on enqueue |
| `packages/queue/src/connection.ts` | `createQueue` factory | **Use** for ingest queue |
| `packages/db/src/schema/ingest.ts` | `reports`, enums | Insert/upsert in service |
| `apps/api/src/routes/capture/` | **Missing** | **Create** presign + complete |
| `apps/api/src/middleware/ingest-key-auth.ts` | **Missing** | **Create** |
| `apps/api/src/middleware/api-key-auth.ts` | Rejects ingest bearer on v1 | Unchanged; capture uses X-Ingest-Key |
| `apps/api/src/middleware/onboarding-gate.ts` | Blocks zero-org session | Capture routes must **bypass** |
| `apps/worker/src/index.ts` | Stub boot | **Unchanged** (no processor) |

**Do not touch:** Web app shell (E3-S1), SDK submit HTTP (E1-S5), `_bmad-output/` except this file.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| §4 Ingest Pipeline | Sequence: presign → client PUT R2 → complete → enqueue finalize |
| §4 Endpoints | `POST /api/v1/capture/presign`, `/complete`; auth = ingest key |
| §4 Idempotency | Header `Idempotency-Key`; unique `(project_id, idempotency_key)` |
| §4 Queues | Job `ingest.finalize` on queue `ingest`; payload refs-only |
| §4 Payload caps | Presign path for large payloads; inline ≤1 MB is E2-S3 |
| §6 API key auth | `ubr_ingest_*` → `/api/v1/capture/*` only |
| §7 R2 key layout | `{orgId}/{projectId}/{reportId}/replay/batch-{seq}.json.gz` etc. |
| §12 Errors | 401 `UNAUTHORIZED`, 422 `VALIDATION_ERROR`, 202 on complete |
| §5.1 CaptureIngestService | File `packages/services/src/ingest.ts` |
| AD-4 | R2-first; never queue blob bytes |
| AD-5 | Idempotent presign returns same reportId |
| ARCHITECTURE-SPINE | Auth header: `X-Ingest-Key: ubr_ingest_*` for capture |

### Ingest auth header (critical)

Use **`X-Ingest-Key`** header (not Bearer) for capture routes — matches ARCHITECTURE-SPINE, epic E2-S2, E1-S4 SDK handoff. Existing `api-key-auth.ts` already rejects `Authorization: Bearer ubr_ingest_*` on general v1 routes — keep that behavior.

Also accept **`Idempotency-Key`** header (required on presign/complete).

Optional future: body `projectKey` for simple clients — **out of scope** unless needed for tests.

### Presign request/response contract (implementer spec)

**Request `POST /api/v1/capture/presign`:**

```json
{
  "title": "Optional default title",
  "description": "Optional",
  "parts": [
    { "name": "replay", "contentType": "application/gzip", "seq": 0 },
    { "name": "console", "contentType": "application/gzip" },
    { "name": "network", "contentType": "application/gzip" },
    { "name": "screenshot", "contentType": "image/webp" },
    { "name": "meta", "contentType": "application/json" }
  ]
}
```

**Response 200:**

```json
{
  "reportId": "rpt_...",
  "uploads": [
    { "part": "replay", "key": "{orgId}/{projectId}/{reportId}/replay/batch-0.json.gz", "url": "https://...", "contentType": "application/gzip" }
  ]
}
```

**Complete `POST /api/v1/capture/complete`:**

```json
{ "reportId": "rpt_...", "r2Keys": [".../replay/batch-0.json.gz", "..."] }
```

**Response 202:**

```json
{ "reportId": "rpt_...", "status": "processing" }
```

Align part names with `report_blob_type` enum in schema (`replay`, `screenshot`, `console`, `network`, `meta`).

### CaptureIngestService design

```typescript
// packages/services/src/ingest.ts — illustrative
export interface CaptureIngestContext {
  organizationId: string;
  projectId: string;
  idempotencyKey: string;
  requestId: string;
}

export function createCaptureIngestService(db, deps: {
  r2: R2Client;
  enqueueFinalize: (payload: IngestFinalizePayload) => Promise<void>;
  generateId: () => string;
}) {
  return {
    presignUpload(ctx, input) { /* upsert report pending, presignPut each part */ },
    completeIngest(ctx, input) { /* validate, enqueue, return processing */ },
  };
}
```

**Report row on presign:** Set `title` from body or default `"Untitled report"`, `status=open`, `ingest_status=pending`, `organization_id`, `project_id`, `idempotency_key`.

**On complete:** Do not insert `report_blobs` yet — worker E2-S4 owns metadata writes after HEAD validate.

### Onboarding gate bypass

Capture endpoints are called by SDK with project ingest key — no user session. Register capture routes **outside** onboarding gate scope:

- Option A: Mount capture plugin on path prefix excluded in `onboarding-gate.ts` matcher
- Option B: Register before gate middleware with ingest-key-only auth

Verify zero-org SDK ingest still works (common for first report during onboarding E3-S2).

### Queue enqueue pattern

```typescript
import { createQueue, JOB_NAMES, QUEUE_NAMES, ingestFinalizePayloadSchema } from "@usebugreport/queue";

const ingestQueue = createQueue(QUEUE_NAMES.INGEST, ingestFinalizePayloadSchema);

await ingestQueue.add(JOB_NAMES.INGEST_FINALIZE, ingestFinalizePayloadSchema.parse({
  reportId,
  r2Keys,
  projectId,
  idempotencyKey,
}));
```

No Worker registration in API process (architecture §16).

### Previous story intelligence

**From E2-S1 (2-1-core-ingest-schema-and-queue-payloads.md):**

- Migration `0001`+ ingest tables; unique partial index on idempotency
- `presignPut` default TTL 900s
- Queue invariant test — no Buffer in payloads
- `project_id` FK to `projects` now exists (E4-S3 applied `0003`)

**From E4-S3 (4-3-workspace-and-project-crud-with-ingest-keys.md):**

- `validateIngestKey` scans active keys with `Bun.password.verify`
- Ingest plaintext format `ubr_ingest_` + 32 base62 chars
- Rotate sets `revoked_at` — old key must fail presign (401)
- Integration test pattern in `workspace-project.integration.test.ts`

**From E1-S4 (1-4-publishable-usebugreport-browser-sdk-package.md):**

- SDK stores `projectKey` for future `X-Ingest-Key` header
- `submit()` returns payload parts — E1-S5 will HTTP upload using presign flow from this story

**From infra-1 (api platform):**

- Error envelope + `requestId` via platform plugins — reuse `unauthorizedError`, `validationError`
- OpenAPI public filter — capture routes may be `internal` or `public` SDK surface

### Performance note (AC2)

Complete endpoint is **enqueue-only** — target p95 < 200ms. Avoid synchronous R2 HEAD on complete; worker validates in E2-S4. Log `durationMs` for observability hook to `ubr_ingest_duration_seconds` (optional metric stub).

### Anti-patterns (do NOT)

- Do not write blob bytes to Postgres or Redis queue
- Do not require session cookie on capture routes
- Do not implement finalize worker logic in API handlers
- Do not log presigned URLs or full r2 keys (redact in Pino)
- Do not use `Authorization: Bearer ubr_ingest_*` as primary capture auth (use X-Ingest-Key)
- Do not skip idempotency header validation

### Git intelligence (HEAD `a2d6313`)

Main includes E4 CRUD + ingest key validation + queue/storage foundations. This story connects them with HTTP capture surface.

### Project Structure Notes

New files (expected):

```text
packages/services/src/ingest.ts
packages/services/src/ingest.test.ts
apps/api/src/middleware/ingest-key-auth.ts
apps/api/src/routes/capture/index.ts
apps/api/src/__tests__/capture-presign.integration.test.ts
```

Modified:

```text
packages/services/src/index.ts
apps/api/src/index.ts
```

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E02-ingest-pipeline-storage.md#Story E2-S2]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§4 Ingest Pipeline]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§6 API key auth]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§7 R2 key layout]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§12 API Conventions]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#Auth headers]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-4]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-5]
- [Source: _bmad-output/implementation-artifacts/2-1-core-ingest-schema-and-queue-payloads.md]
- [Source: _bmad-output/implementation-artifacts/4-3-workspace-and-project-crud-with-ingest-keys.md]
- [Source: _bmad-output/implementation-artifacts/1-4-publishable-usebugreport-browser-sdk-package.md]
- [Source: packages/services/src/project.ts — validateIngestKey]
- [Source: packages/storage/src/r2.ts — presignPut]
- [Source: packages/queue/src/payloads/ingest.ts]

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
DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" bun test apps/api/src/__tests__/capture-presign.integration.test.ts
bun test packages/queue/src/__tests__/payload-invariant.test.ts
```

| Case | Expected |
| --- | --- |
| Valid ingest key + idempotency → presign | 200, reportId, uploads[].url |
| Same idempotency retry | Same reportId |
| Complete with r2Keys | 202 processing; Redis job payload refs-only |
| Revoked / wrong key | 401 UNAUTHORIZED |
| Ingest key on GET /api/v1/projects | 401 (session required) |
| Queue payload | Passes `ingestFinalizePayloadSchema`; no binary fields |

## Dev Agent Record

### Agent Model Used

composer-2.5-fast

### Debug Log References

- branch `feat/presign-ingest` from `main`
- docker postgres + redis for integration tests

### Completion Notes List

- added `CaptureIngestService` with presign upsert, R2 key layout, idempotency, and refs-only finalize enqueue
- added `X-Ingest-Key` + `Idempotency-Key` capture routes bypassing onboarding gate and session auth
- integration tests cover presign→complete BullMQ job, idempotency, revoked key 401, ingest key rejected on session routes
- `@usebugreport/api`, `@usebugreport/services`, `@usebugreport/queue`, `@usebugreport/worker` lint/typecheck/test/build pass; `@usebugreport/web#build` fails pre-existing MantineProvider prerender (out of scope)

### File List

- apps/api/package.json
- apps/api/src/__tests__/capture-presign.integration.test.ts
- apps/api/src/index.ts
- apps/api/src/middleware/ingest-key-auth.ts
- apps/api/src/middleware/onboarding-gate.ts
- apps/api/src/routes/capture/index.ts
- packages/services/src/ingest.ts
- packages/services/src/ingest.test.ts
- packages/services/src/index.ts

### Change Log

- 2026-07-20: E2-S2 presign + complete ingest HTTP path with ingest-key auth and BullMQ enqueue
