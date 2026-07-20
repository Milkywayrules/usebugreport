---
baseline_commit: 822e438
depends_on:
  - 2-4-ingest-finalize-worker
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
---

# Story 2.6: Usage quotas and ingest rate limits

Status: review

## Story

As a workspace on Free or Pro tier,
I want ingest blocked at quota with clear 429 responses,
so that tier limits are enforced at the boundary (FR-4, LG-8, AD-9, AD-11).

## Acceptance Criteria

1. **Given** Free tier at monthly cap, **when** presign or inline ingest starts a new report, **then** HTTP 429 `QUOTA_EXCEEDED` before enqueue.
2. **Given** Pro tier at fair-use cap, **when** ingest attempted, **then** HTTP 429 with `Retry-After` from quota reset.
3. **Given** ingest key exceeds Redis sliding window (20/min burst), **when** capture endpoints called, **then** HTTP 429 `RATE_LIMITED`.
4. **Given** 100 active finalize jobs for a workspace, **when** enqueue attempted, **then** HTTP 429 `RATE_LIMITED` back-pressure.

## Tasks / Subtasks

- [x] Task 1 — Quota gate in `CaptureIngestService` before new reports / finalize enqueue
- [x] Task 2 — Redis per-key rate limit on capture routes
- [x] Task 3 — Workspace finalize concurrency tracking in worker
- [x] Task 4 — Tests + sprint status

## Dev Agent Record

### Completion Notes

- Monthly usage still increments on finalize completion only (AD-9).
- Finalize payload includes `organizationId` for worker accounting.
