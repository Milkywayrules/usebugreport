---
baseline_commit: 0eb17bb
depends_on:
  - 3-4-dense-report-list-with-keyboard-navigation
  - 2-5-reportservice-metadata-reads-and-replay-manifest
---

# Story 3.5: Bulk status change

Status: review

## Story

As a triage lead,
I want to change status for multiple selected reports at once,
so that queue hygiene stays fast at agency scale (FR-11).

## Acceptance Criteria

1. Bulk bar appears when selection > 0; menu and digit keys apply status via `ReportService.updateStatus`.
2. Optimistic list updates revert with toast on partial failure.
3. Playwright covers bulk status on three fixtures.

## Tasks / Subtasks

- [x] `ReportService.updateStatus` + PATCH route
- [x] Bulk bar + list mutation wiring
- [x] Playwright bulk-status spec
