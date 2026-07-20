---
baseline_commit: c9cd470
depends_on:
  - 9-2-external-purge-r2-and-redis-before-postgres
blocks:
  - 9-4-gdpr-e2e-and-deletion-status-ux
---

# Story 9.3: Postgres purge last with idempotent step resume

Status: review

## Dev Agent Record

- `DeletionService.processAuditTerminal` writes metadata-only audit to tombstone + `audit_log`.
- `DeletionService.processPostgresPurge` deletes tenant rows in architecture order; tombstone marked complete.
- Worker handles `deletion.audit_terminal` and `deletion.postgres_purge`; chain continues after external purge.
- Completion email via `sendDeletionLifecycleEmail` when `RESEND_API_KEY` is set.
