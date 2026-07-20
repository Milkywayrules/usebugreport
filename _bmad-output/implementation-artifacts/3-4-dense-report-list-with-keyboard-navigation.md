---
baseline_commit: 822e438
depends_on:
  - 2-5-reportservice-metadata-reads-and-replay-manifest
  - 3-1-web-app-shell-theme-and-route-scaffold
blocks:
  - 3-5-bulk-status-change
---

# Story 3.4: Dense report list with keyboard navigation

Status: review

## Story

As a triage lead,
I want a filterable report table with j/k/x navigation,
so that I can review queues without a mouse (FR-11, LG-9).

## Acceptance Criteria

1. **Given** `/w/[slug]/reports`, **when** page loads, **then** TanStack Table shows status/title/project/reporter/age/Linear columns with URL-synced filters.
2. **Given** list focused, **when** user presses j/k/x/Shift+X/Enter/, **then** keyboard map from EXPERIENCE.md works.
3. **Given** viewer role, **when** list renders, **then** selection shortcuts are disabled.

## Tasks / Subtasks

- [x] Task 1 — `ReportService.listReports` + `GET /api/v1/reports`
- [x] Task 2 — Dense list UI with TanStack Table + keyboard nav
- [x] Task 3 — Sprint status + verification

## Dev Agent Record

### Completion Notes

- Search endpoint exposed at `GET /api/v1/reports/search` for future palette (E3-S9).
- Status hotkeys (1–5) land in E3-S5 bulk/status story.
