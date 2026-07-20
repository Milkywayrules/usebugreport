---
baseline_commit: 31d9479
depends_on:
  - 6-3-rest-report-endpoints
blocks: []
---

# Story 6.4: REST parity contract tests (real HTTP)

Status: review

## Story

As a CI pipeline,
I want parity tests over live REST HTTP,
so that launch gate LG-6 is verifiable (AD-2).

## Acceptance Criteria

1. **Given** `packages/contracts/tests/parity.test.ts`, **when** `turbo test:parity` runs, **then** registry read ops hit `/api/v1/*` via `fetch()`.
2. **Given** auth failures, **then** `UNAUTHORIZED` / `FORBIDDEN` envelopes are asserted.
3. **Given** list endpoint, **then** cursor pagination and filters are covered.

## Dev Agent Record

### Completion Notes

- Bun.serve + live `fetch()` against exported API app (no `.handle()` shortcuts).
- Exercises all launch-gated GET surface registry entries.
