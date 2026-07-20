---
baseline_commit: 1c37d9f
depends_on:
  - 3-5-bulk-status-change
  - 7-2-outbox-backed-linear-push-worker
---

# Story 3.6: Bulk Linear push

Status: review

## Story

As a triage lead,
I want to push many selected reports to Linear in one action,
so that cross-client staging sweeps stay efficient.

## Acceptance Criteria

1. Bulk bar and `p` hotkey open confirm modal when Linear is connected.
2. Parallel pushes call `POST /api/v1/reports/:id/linear/push` per report.
3. Toast summarizes success/failure counts with failed IDs.
4. Push disabled with tooltip when Linear is not configured.

## Dev Agent Record

### Completion Notes

- `bulkPushReportsToLinear` helper with partial-failure summary.
- Bulk bar + palette `bulk.push-linear` wired on report list.
