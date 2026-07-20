---
baseline_commit: 31376462c9028dfe0c25744f7dd0da85bf2c622b
depends_on:
  - 3-10-central-keyboard-shortcuts-registry
  - 3-4-dense-report-list-with-keyboard-navigation
---

# Story 3.9: Command palette (⌘K)

Status: review

## Story

As a power user,
I want ⌘K Spotlight actions for navigation and report operations,
so that triage stays keyboard-centric (FR-12, LG-9).

## Acceptance Criteria

1. ⌘K opens Mantine Spotlight with static nav/workspace/report actions.
2. Typing ≥2 chars queries report search API and filters projects client-side.
3. Recent five commands stored in `localStorage` key `ubr_spotlight_recent`.
4. Bulk and report context actions reuse list/detail mutations.

## Tasks / Subtasks

- [x] `useRegisterSpotlightActions` hook wired to shortcuts registry ids
- [x] Dynamic `/api/v1/reports/search` provider
- [x] Recent commands section + unit test
- [x] Spotlight bridge from report list and detail routes
