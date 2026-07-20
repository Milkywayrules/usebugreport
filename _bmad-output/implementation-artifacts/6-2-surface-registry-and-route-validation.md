---
baseline_commit: 31376462c9028dfe0c25744f7dd0da85bf2c622b
depends_on:
  - 6-1-domain-services-and-ad-1-lint-gate
blocks:
  - 6-3-rest-report-endpoints
---

# Story 6.2: Surface registry and route validation

Status: review

## Story

As an API consumer,
I want a single registry declaring REST paths, MCP tools, scopes,
so that parity is mechanically enforced (AD-2).

## Acceptance Criteria

1. **Given** `packages/contracts/src/surface-registry.ts` with v1 read operations, **when** `packages/contracts/scripts/validate-routes.ts` runs at build, **then** every launch-gated entry has matching Elysia route and MCP tool registration.
2. **Given** registry entry shape, **when** inspected, **then** fields include `{ id, service, method, rest, mcp, scopes }` (AD-2).
3. **Given** `comments.create` entry, **when** v1.0 build runs, **then** entry marked `launchGate: false` — routes not required until E10.

## Tasks / Subtasks

- [x] Populate `SURFACE_REGISTRY` with architecture §5.2 read operations + gated comment write
- [x] Zod entry schema validation at module load
- [x] Build-time `validate-routes.ts` wired into contracts build
- [x] MCP tool registration stubs under `apps/api/src/mcp/tools`

## Dev Agent Record

### Completion Notes

- Route validation normalizes `:id` / `:reportId` param names before matching Elysia paths.
- Fast-follow `comments.create` is excluded from route/MCP requirements and must stay absent from handlers until E10.
