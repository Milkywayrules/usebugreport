---
baseline_commit: c6dbc18be4e7461c5e4ad276363e770ebe78ff89
depends_on:
  - 2-5-reportservice-metadata-reads-and-replay-manifest
blocks:
  - 6-2-surface-registry-and-route-validation
---

# Story 6.1: Domain services and AD-1 lint gate

Status: review

## Story

As a backend engineer,
I want ReportService and SearchService as sole business-logic owners,
so that REST and MCP never duplicate queries (FR-18, AD-1).

## Acceptance Criteria

1. **Given** `packages/services/src/report.ts` and `search.ts`, **when** methods `list`, `getById`, `getSummary`, `getConsoleLogs`, `getNetworkRequests`, `searchReports` run, **then** each accepts `AuthContext` first with mandatory `organizationId` (AD-3).
2. **Given** CI lint on `apps/api/src/routes` and `apps/api/src/mcp`, **when** Drizzle imports or R2 client usage is detected, **then** build fails (AD-1).
3. **Given** PR template, **when** a developer opens a route handler PR, **then** checkbox confirms no inline DB queries (architecture §5.3).

## Tasks / Subtasks

- [x] ReportService `list` alias + org/replay helpers moved from routes
- [x] WorkspaceService.listMembers for member route reads
- [x] `apps/api/scripts/check-ad1-domain-boundary.sh` wired into lint/test
- [x] `.github/pull_request_template.md` AD-1 checkbox

## Dev Agent Record

### Completion Notes

- Report and search read paths remain in `packages/services`; API routes delegate via injected services from `apps/api/src/index.ts`.
- AD-1 grep gate blocks `@usebugreport/db`, `drizzle-orm`, and `createR2Client` under routes/mcp.
