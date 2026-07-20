---
baseline_commit: 31d9479
depends_on:
  - 7-1-linear-oauth-and-integrationservice-config
blocks:
  - 7-3-outbox-pending-and-failed-conflict-branches
---

# Story 7.2: Outbox-backed Linear push worker

Status: review

## Story

As a triage user,
I want push to create a Linear issue with report link and console excerpt,
so that bugs enter the client workflow (FR-21).

## Acceptance Criteria

1. **Given** `IntegrationService.pushReportToLinear`, **when** called, **then** outbox row + `integrations.linear_push` job with refs only.
2. **Given** worker job success, **then** Linear issue created and report `linear_issue_*` fields updated.
3. **Given** duplicate push after success, **then** existing `external_url` returned without new issue.

## Dev Agent Record

### Completion Notes

- `integration_operations` outbox table and `IntegrationService.pushReportToLinear` / `processLinearPushJob`.
- Worker `apps/worker/src/jobs/integrations.ts` on queue `integrations`, concurrency 5.
- API `POST /api/v1/reports/:reportId/linear/push` for session callers.
