---
baseline_commit: 0eb17bb
depends_on:
  - 3-4-dense-report-list-with-keyboard-navigation
blocks:
  - 3-9-command-palette-cmd-k
---

# Story 3.10: Central keyboard shortcuts registry

Status: review

## Story

As a developer,
I want one SHORTCUTS map consumed by Spotlight and useHotkeys,
so that keyboard behavior never drifts (AD-10).

## Acceptance Criteria

1. `apps/web/src/keyboard/shortcuts.ts` centralizes list, detail, replay, workspace, and global bindings.
2. Report list and replay viewer register hotkeys only via `useReportListHotkeys` / `useReplayViewerHotkeys`.
3. `?` opens a shortcuts reference modal; `/` focuses list search even when an input is focused.
4. CI grep rejects `keydown` listeners outside `apps/web/src/keyboard/`.

## Tasks / Subtasks

- [x] Expand SHORTCUTS registry + modal
- [x] Refactor list/replay hotkeys + global `?` host
- [x] Listener guard script + unit tests
