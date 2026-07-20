---
baseline_commit: 1c37d9f
depends_on:
  - 7-2-outbox-backed-linear-push-worker
blocks:
  - 3-6-bulk-linear-push
---

# Story 7.3: Outbox pending and failed conflict branches

Status: review

## Story

As a concurrent triage session,
I want safe behavior when multiple pushes race or prior push failed,
so that we never duplicate issues or lose retry paths.

## Acceptance Criteria

1. Concurrent push while `status=pending` returns in-progress without a second queue job.
2. Failed rows require `{ retry: true }` before re-enqueue.
3. Explicit retry flips `failed → pending` and enqueues exactly one job.
4. Unit tests cover pending, succeeded, failed, and fresh enqueue paths.

## Dev Agent Record

### Completion Notes

- `pushReportToLinear` accepts `PushReportToLinearOptions.retry` for failed rows.
- API `POST /api/v1/reports/:reportId/linear/push` reads optional `{ retry: true }`.
- Expanded `integration-linear-push.test.ts` with mock-db branch coverage.
