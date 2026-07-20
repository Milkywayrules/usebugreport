---
baseline_commit: 24403f9
depends_on:
  - 1-4-publishable-usebugreport-browser-sdk-package
  - 2-2-presign-and-complete-ingest-path
---

# Story 1.5: SDK submit widget (shadow DOM)

Status: review

## Story

As an end user filing a bug,
I want a lightweight submit modal from the SDK widget or host hotkey,
so that I can title and submit a report without leaving the host app (FR-1).

## Acceptance Criteria

1. **Given** SDK `init()` with widget enabled (default), **when** user opens submit UI, **then** shadow-root modal shows title, description, Submit/Cancel with Mantine-free dark styling.

2. **Given** successful ingest API response, **when** submit completes, **then** modal closes and `onSubmit` receives `reportId`.

3. **Given** HTTP 401 or 429, **when** submit fails, **then** modal shows actionable error copy (429 includes upgrade path).

4. **Given** capture payload size, **when** upload runs, **then** SDK chooses inline (`POST /capture/ingest`) or presign+complete path and sends `Idempotency-Key` + `X-Ingest-Key`.

## Tasks / Subtasks

- [x] Task 1 — Ingest HTTP client (`packages/sdk/src/ingest-client.ts`)
- [x] Task 2 — Shadow DOM widget (`packages/sdk/src/widget/`)
- [x] Task 3 — Init/dispose wiring + exports
- [x] Task 4 — Unit tests (ingest client + widget modal)
- [x] Task 5 — Sprint status + verification gate

## Dev Agent Record

### Completion Notes

- Default widget mounts floating button + Shift+Alt+B hotkey; pass `widget: false` to disable.
- `apiBaseUrl` defaults to `window.location.origin`.
