---
baseline_commit: 24403f9
depends_on:
  - 2-4-ingest-finalize-worker
blocks:
  - 3-4-dense-report-list-with-keyboard-navigation
---

# Story 2.5: ReportService metadata reads and replay manifest

Status: review

## Story

As a web or API consumer,
I want report metadata and presigned replay URLs,
so that the replay viewer loads blobs client-side without API proxy (FR-5, FR-6, AD-6).

## Acceptance Criteria

1. **Given** authenticated context with project access, **when** `ReportService.getById`, `getSummary`, `getConsoleLogs`, `getNetworkRequests` run, **then** every query includes `organization_id` from `AuthContext` (AD-3), **and** console/network blobs are fetched from R2 server-side and returned as JSON, **and** `getReplayManifest` returns presigned GET URLs (TTL 15 min) for replay and screenshot blobs.

2. **Given** `SearchService.searchReports` with a query string, **when** search runs, **then** `websearch_to_tsquery('english', q)` matches `reports.search_vector` with rank ordering.

3. **Given** `bun test packages/services`, **when** tests run with Docker Postgres (`DATABASE_URL`), **then** report read and search coverage passes.

## Tasks / Subtasks

- [x] Task 1 — `ReportService` reads (`packages/services/src/report.ts`)
- [x] Task 2 — `SearchService.searchReports` (`packages/services/src/search.ts`)
- [x] Task 3 — Unit/integration tests (`report.test.ts`, `search.test.ts`)
- [x] Task 4 — Sprint status + verification gate

## Dev Agent Record

### Completion Notes

- Replay manifest exposes presigned GET URLs only (not via MCP surface registry in this story).
- Console/network paths decompress gzip JSON from R2 keys written at finalize.
