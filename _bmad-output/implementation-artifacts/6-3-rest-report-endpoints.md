---
baseline_commit: 9e738d8f297ea3bdd5b9245adc4420964eadc486
depends_on:
  - 6-2-surface-registry-and-route-validation
blocks:
  - 6-4-rest-parity-contract-tests-real-http
---

# Story 6.3: REST report endpoints

Status: review

## Story

As an API consumer,
I want GET endpoints for reports with Bearer API keys,
so that agents can use REST with the same data as session users (FR-17).

## Acceptance Criteria

1. **Given** Bearer `ubr_live_*` with `reports:read`, **when** calling registry GET `/api/v1/reports*` routes, **then** responses match session auth for the same workspace.
2. **Given** missing scope or invalid key, **when** calling those routes, **then** `401` / `403` envelopes match platform error shape.

## Dev Agent Record

### Completion Notes

- `resolveReportReadAccess` centralizes session + API key auth with `reports:read` scope gate.
- Web-only routes (`replay-manifest`, status PATCH) remain session-only.
