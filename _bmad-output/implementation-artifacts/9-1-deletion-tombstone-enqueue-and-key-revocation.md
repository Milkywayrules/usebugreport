---
baseline_commit: b5e7a7e
depends_on:
  - 4-1-better-auth-github-oauth-and-session
blocks:
  - 9-2-external-purge-r2-and-redis-before-postgres
---

# Story 9.1: Deletion tombstone enqueue and key revocation

Status: review

## Dev Agent Record

- `deletion_tombstones` schema (no org FK) and `DeletionService.enqueueWorkspaceDeletion`.
- Step 0 revokes ingest keys, workspace API keys, and disables webhooks; enqueues `deletion.notify_owner`.
- Owner APIs: `POST /api/v1/workspaces/:id/deletion`, `GET .../deletion-status`.
