---
baseline_commit: df00624
depends_on:
  - 9-1-deletion-tombstone-enqueue-and-key-revocation
blocks:
  - 9-3-postgres-purge-last-with-idempotent-step-resume
---

# Story 9.2: External purge — R2 and Redis before Postgres

Status: review

## Dev Agent Record

- `DeletionService.processExternalPurge` batch-deletes R2 under `{orgId}/` and purges Redis keys.
- Worker handles `deletion.external_purge` with concurrency 2 on deletion queue.
