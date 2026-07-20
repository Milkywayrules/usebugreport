---
baseline_commit: a053c49
depends_on:
  - 2-4-ingest-finalize-worker
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
---

# Story 2.7: Retention sweep and stale-pending cleanup

Status: review

## Story

As a workspace admin,
I want tier-based blob expiry and orphan reconciliation,
so that storage costs align with billing tier (FR-7, LG-11).

## Acceptance Criteria

1. **Given** expired `report_blobs`, **when** `retention.sweep` runs, **then** R2 objects and blob rows are removed.
2. **Given** Free metadata retention elapsed, **when** sweep runs, **then** blob refs clear while report summary remains.
3. **Given** pending ingest older than 24h, **when** sweep runs, **then** report row and orphan R2 keys are removed best-effort.
4. **Given** orphan R2 keys under `{orgId}/`, **when** reconciliation runs, **then** keys without blob rows and older than 24h are deleted.
5. **Given** tier change, **when** `UsageService.recomputeRetention(orgId)` runs, **then** active blob expiry dates batch-update without touching already-expired blobs.

## Tasks / Subtasks

- [x] Task 1 — `RetentionService.runSweep` in `packages/services/src/retention.ts`
- [x] Task 2 — R2 `deleteObject` / `listObjects` helpers
- [x] Task 3 — `retention.sweep` worker (`apps/worker/src/jobs/retention.ts`, concurrency 1)
- [x] Task 4 — `UsageService.recomputeRetention`
- [x] Task 5 — Tests + sprint status

## Dev Agent Record

### Completion Notes

- Worker boots ingest and retention queues together from `apps/worker/src/index.ts`.
- Orphan and stale-pending R2 deletes are best-effort (errors swallowed per architecture mandate).
