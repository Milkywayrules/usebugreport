---
baseline_commit: 9e738d8f297ea3bdd5b9245adc4420964eadc486
depends_on:
  - 4-4-project-level-rbac
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
blocks:
  - 7-2-outbox-backed-linear-push-worker
  - 3-6-bulk-linear-push
---

# Story 7.1: Linear OAuth and IntegrationService config

Status: review

## Story

As a workspace developer,
I want to connect Linear via OAuth and map default teams,
so that pushes can target the correct tracker (FR-20).

## Acceptance Criteria

1. **Given** Linear OAuth env vars, **when** admin completes OAuth, **then** tokens are encrypted in `integrations.oauth_tokens_encrypted`.
2. **Given** Free tier with one integration, **when** second connect is attempted, **then** `UsageService.checkTierLimit('integrations')` rejects.
3. **Given** disconnect, **when** admin clicks disconnect, **then** integration row is revoked.
4. **Given** project default team PATCH, **when** developer saves, **then** `projects.default_linear_team_id` updates.

## Dev Agent Record

### Completion Notes

- `IntegrationService` handles authorize URL, callback connect, disconnect, team list, and project default team mapping.
- Web settings at `/w/[slug]/settings/integrations/linear` drives connect/disconnect UX.
