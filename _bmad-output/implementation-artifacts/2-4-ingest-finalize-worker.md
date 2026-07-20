---
baseline_commit: 9902b56c
depends_on:
  - 2-2-presign-and-complete-ingest-path
  - 2-3-inline-ingest-path-with-ack-latency-measurement
blocks:
  - 2-5-reportservice-metadata-reads-and-replay-manifest
---

# Story 2.4: ingest.finalize worker

Status: review

## Story

As a platform operator,
I want the worker to validate R2 objects and write Postgres metadata,
so that reports become searchable and webhook-ready (FR-5, LG-1).

## Acceptance Criteria

1. **Given** `ingest.finalize` job `{ reportId, r2Keys[], projectId, idempotencyKey }`, **when** `apps/worker/src/jobs/ingest.ts` processes the job via `CaptureIngestService.processFinalizeJob`, **then** each R2 key is HEAD-validated, **and** `report_blobs` rows are inserted, **and** `reports.summary` / `summary_text` / `environment` are updated from `meta.json`, **and** `ingest_status=complete`, **and** `UsageService.increment` runs once per completed report (AD-9).

2. **Given** duplicate finalize for the same completed report, **when** the worker runs again, **then** no duplicate blob rows and usage is not double-counted (AD-5).

3. **Given** ingest finalize completes, **when** webhooks are registered (E8), **then** `webhooks.dispatch` jobs may be enqueued for `report.created`; **when** none registered, enqueue is a no-op.

4. **Given** `bun test`, **when** services/worker/storage tests run, **then** finalize unit coverage passes with Docker Postgres when `DATABASE_URL` is set.

## Tasks / Subtasks

- [x] Task 1 — R2 HEAD/GET primitives (`packages/storage/src/r2.ts`)
- [x] Task 2 — `CaptureIngestService.processFinalizeJob` (`packages/services/src/ingest.ts`)
- [x] Task 3 — BullMQ worker processor (`apps/worker/src/jobs/ingest.ts`, boot in `apps/worker/src/index.ts`)
- [x] Task 4 — Unit tests (`packages/services/src/ingest.test.ts`)
- [x] Task 5 — Sprint status + verification gate

## Dev Agent Record

### Completion Notes

- Worker consumes `ingest` queue job `ingest.finalize` with concurrency capped at 10.
- Webhook fan-out stub returns zero registrations until E8 lands.
