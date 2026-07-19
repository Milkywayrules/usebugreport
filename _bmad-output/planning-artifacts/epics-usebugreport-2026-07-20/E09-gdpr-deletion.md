# Epic E9: GDPR Cascading Deletion

**Goal:** Tombstone-ordered workspace deletion with external cleanup before Postgres purge and idempotent resume (LG-7).

**FRs:** FR-10 | **ADs:** AD-8

---

## Story E9-S1: Deletion tombstone enqueue and key revocation

As a workspace owner,
I want to initiate deletion from the danger zone,
So that all tenant data is scheduled for cascade removal (FR-10).

**Acceptance Criteria:**

**Given** `/w/[slug]/settings/danger` multi-step modal (type slug, retention summary, confirm) (EXPERIENCE.md Flow 4)
**When** owner confirms deletion
**Then** `DeletionService.enqueueWorkspaceDeletion(orgId)` creates `deletion_tombstones` row with **no FK to `organizations`** (AD-8)
**And** step 0 runs immediately: revoke all `ingest_keys`, `workspace_api_keys`; disable `webhook_endpoints` (architecture §9)

**Given** tombstone created
**When** user redirected
**Then** `/settings/workspaces` shows banner "Deletion in progress" (EXPERIENCE.md)

**Given** `GET /api/v1/workspaces/:id/deletion-status` (owner only)
**When** polled
**Then** returns tombstone `status` and `last_completed_step` from tombstone table (architecture §9)

**Technical notes:** Table `deletion_tombstones` columns per architecture §3.1. Queue `deletion` jobs. Email snapshot fields on tombstone.

**Dependencies:** E4-S1, E3-S1 (danger UI shell).

---

## Story E9-S2: External purge — R2 and Redis before Postgres

As the deletion job,
I want to purge blobs and Redis keys while tombstone survives,
So that org row can still be referenced until final purge (AD-8 board mandate).

**Acceptance Criteria:**

**Given** tombstone step ≥ notify completed
**When** `deletion.external_purge` job runs
**Then** batch deletes R2 objects under `/{orgId}/` prefix (1000 keys/batch) (architecture §9 step 2)
**And** `SCAN` deletes Redis keys matching `ubr:*:{orgId}:*`
**And** updates `deletion_tombstones.last_completed_step` on success for idempotent resume

**Given** job retries after partial R2 delete
**When** re-run
**Then** list-and-delete is idempotent — no error on missing keys (AD-8)

**Given** ordering constraint
**When** external purge runs
**Then** **Postgres tenant rows for org still exist** — purge has not started (AD-8 tombstone ordering)

**Technical notes:** `DeletionService.processStep` in `packages/services/src/deletion.ts`. Worker concurrency 2 on `deletion` queue.

**Dependencies:** E9-S1, E2-S4 (R2 layout).

---

## Story E9-S3: Postgres purge last with idempotent step resume

As the deletion job,
I want Postgres tenant purge as the final step after audit terminal,
So that tombstone control record outlives FK cascade (AD-8).

**Acceptance Criteria:**

**Given** steps 0–2 complete
**When** `deletion.audit_terminal` runs
**Then** terminal audit written to tombstone `audit_metadata` and `audit_log` — metadata only, no report bodies (FR-10, 90-day retention)

**Given** audit terminal complete
**When** `deletion.postgres_purge` runs **last**
**Then** deletes in order: reports → comments → blobs → projects → integrations → webhooks → usage → org (architecture §9 step 4)
**And** tombstone `status=complete`, `completed_at` set
**And** p95 full cascade ≤ 72 hours (FR-10)

**Given** failure mid-step
**When** job retries with exponential backoff
**Then** resumes from `last_completed_step` without duplicating completed work (AD-8 board mandate)

**Given** owner email
**When** job completes
**Then** completion email sent via worker (`RESEND_API_KEY` or equivalent) (FR-10)

**Technical notes:** Org slug released after purge. Audit log retained 90 days legal minimum (FR-10).

**Dependencies:** E9-S2.

---

## Story E9-S4: GDPR E2E and deletion-status UX

As a compliance reviewer,
I want Playwright coverage of the deletion flow,
So that LG-7 is verified end-to-end (FR-10).

**Acceptance Criteria:**

**Given** staging org with reports and R2 fixtures
**When** Playwright runs GDPR flow (architecture §13 item 5)
**Then** tombstone survives through external purge; org row exists until postgres_purge step completes

**Given** deletion in progress
**When** owner polls deletion-status API
**Then** step progression visible until `complete`

**Given** completed deletion
**When** R2 list prefix for orgId
**Then** no objects remain; Postgres org row gone; tombstone records terminal audit

**Technical notes:** bun test integration for step resume idempotency alongside Playwright. No report content in audit entries (SM-C3 alignment).

**Dependencies:** E9-S1, E9-S2, E9-S3.
