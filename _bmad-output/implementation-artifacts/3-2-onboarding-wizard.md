---
baseline_commit: a053c49
depends_on:
  - 3-1-web-app-shell-theme-and-route-scaffold
  - 4-3-workspace-and-project-crud-with-ingest-keys
---

# Story 3.2: Onboarding wizard

Status: review

## Story

As a new user with no workspace,
I want a stepper to create my first workspace and project,
so that I satisfy the membership gate and get an SDK snippet (FR-8, EXPERIENCE.md Flow 5).

## Acceptance Criteria

1. **Given** zero memberships on `/onboarding`, **when** step 1 completes, **then** workspace + project + ingest key are created and step 2 unlocks.
2. **Given** step 2, **when** viewing SDK snippet, **then** `@usebugreport/browser` init shows prefilled `projectKey` with copy control.
3. **Given** step 3, **when** polling every 5s finds a report, **then** redirect to `/w/[slug]/reports/[id]`.
4. **Given** before step 1, **when** user sees skip control, **then** skip to dashboard is disabled until workspace exists.

## Tasks / Subtasks

- [x] Task 1 — Three-step Mantine `Stepper` on `/onboarding`
- [x] Task 2 — Server actions for workspace create + first-report poll
- [x] Task 3 — SDK snippet helper + unit test
- [x] Task 4 — Sprint status

## Dev Agent Record

### Completion Notes

- Step 1 no longer redirects early; skip link routes to report list after workspace creation.
- Default first project name falls back to `My App` when omitted.
