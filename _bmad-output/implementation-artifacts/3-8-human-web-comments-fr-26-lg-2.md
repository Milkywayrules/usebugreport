---
baseline_commit: 31376462c9028dfe0c25744f7dd0da85bf2c622b
depends_on:
  - 3-7-report-detail-and-replay-viewer
  - 4-4-project-level-rbac
---

# Story 3.8: Human web comments (FR-26, LG-2)

Status: review

## Story

As a reporter-or-above project member,
I want to view and create comments on a report from the web app,
so that triage notes stay with the report thread (FR-26).

## Acceptance Criteria

1. Comments tab loads thread via `GET /api/web/reports/:id/comments` through `CommentService.list`.
2. Reporter+ can POST comments via session route; viewer sees read-only thread.
3. Playwright covers composer persistence.

## Tasks / Subtasks

- [x] `report_comments` table + migration
- [x] `CommentService` list/create in `packages/services`
- [x] Session web routes under `apps/api/src/routes/web/comments.ts`
- [x] Report detail Comments tab + optimistic composer
- [x] Playwright spec for comment persistence
