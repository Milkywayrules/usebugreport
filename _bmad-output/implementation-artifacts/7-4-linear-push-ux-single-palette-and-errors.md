---
baseline_commit: cd3ba44
depends_on:
  - 7-2-outbox-backed-linear-push-worker
  - 3-7-report-detail-and-replay-viewer
  - 3-9-command-palette-cmd-k
blocks: []
---

# Story 7.4: Linear push UX — single, palette, and errors

Status: review

## Story

As a developer triaging a report,
I want push from detail, keyboard, and palette with actionable errors,
so that Linear integration feels native.

## Acceptance Criteria

1. Report detail header Push button and `p` hotkey enqueue Linear push with success toast.
2. Linear issue link shown in header when `linearIssueUrl` present.
3. Token refresh failures show inline Alert with Reconnect → OAuth.
4. Command palette Push to Linear invokes push on open report.
5. Playwright e2e covers palette push with mocked API.

## Dev Agent Record

- `ReportDetailHeader`, `use-linear-push`, spotlight + hotkey wiring.
