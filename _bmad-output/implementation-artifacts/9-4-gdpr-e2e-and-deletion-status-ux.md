---
depends_on:
  - 9-3-postgres-purge-last-with-idempotent-step-resume
---

# Story 9.4: GDPR E2E and deletion-status UX

Status: review

## Dev Agent Record

- Danger zone UI with slug confirmation and live deletion-status panel.
- Workspaces list banner when deletion is in progress.
- Playwright `e2e/gdpr-deletion.spec.ts` covers enqueue + status poll.
