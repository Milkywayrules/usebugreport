# Epic E7: Linear Outbound

**Goal:** Linear OAuth, outbox-backed push with race-safe dedupe and pending/failed conflict branches (LG-4).

**FRs:** FR-20, FR-21 | **ADs:** AD-5

---

## Story E7-S1: Linear OAuth and IntegrationService config

As a workspace developer,
I want to connect Linear via OAuth and map default teams,
So that pushes land in the correct tracker (FR-20).

**Acceptance Criteria:**

**Given** `/w/[slug]/settings/integrations/linear`
**When** user completes OAuth
**Then** `IntegrationService.connectLinear` stores encrypted tokens in `integrations.oauth_tokens_encrypted` with `ENCRYPTION_KEY` (architecture §12 secrets)
**And** refresh handled automatically (FR-20)

**Given** Free tier workspace with 1 integration already connected
**When** second integration connect attempted
**Then** `UsageService.checkTierLimit('integrations')` rejects at service layer (AD-11, PRD §9)

**Given** disconnect
**When** admin clicks disconnect
**Then** tokens revoked; push disabled (FR-20)

**Given** project detail default team Select
**When** saved
**Then** `projects.default_linear_team_id` updated (EXPERIENCE.md)

**Technical notes:** Env `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`. GraphQL via Linear SDK. Per-workspace integration profile (FR-20).

**Dependencies:** E4-S4, E4-S6.

---

## Story E7-S2: Outbox-backed Linear push worker

As a triage user,
I want push to create a Linear issue with report link and console excerpt,
So that bugs enter the client workflow (FR-21).

**Acceptance Criteria:**

**Given** `IntegrationService.pushReportToLinear(ctx, reportId)`
**When** called from web, ⌘K, or bulk action
**Then** inserts `integration_operations` row `(report_id, action='linear.push', status='pending')` (architecture §5.5)
**And** on fresh insert enqueues `integrations.linear_push` job with `{ operationId }` refs only (AD-4 queue invariant)

**Given** worker `apps/worker/src/jobs/integrations.ts`
**When** job succeeds
**Then** Linear issue created with title, description, link back, console excerpt (FR-21)
**And** row updated `status=succeeded`, `external_url` stored; `reports.linear_issue_*` fields updated
**And** first-attempt success ≥ 95% when configured (SM-4)

**Given** idempotent second push same report
**When** UNIQUE `(report_id, action)` conflict with `status=succeeded`
**Then** returns existing `external_url` immediately without new Linear issue (FR-21, AD-5)

**Technical notes:** Queue `integrations`, job `integrations.linear_push`, concurrency 5 (architecture §4).

**Dependencies:** E7-S1, E2-S5.

---

## Story E7-S3: Outbox pending and failed conflict branches

As a concurrent triage session,
I want safe behavior when multiple pushes race or prior push failed,
So that we never duplicate issues or lose retry paths (architecture §5.5 board mandate).

**Acceptance Criteria:**

**Given** concurrent push requests for same `report_id`
**When** second request hits UNIQUE constraint while first `status=pending`
**Then** caller receives in-progress result; **no second** `integrations.linear_push` job enqueued (architecture §5.5)

**Given** existing row `status=failed` with error recorded
**When** user explicitly retries push
**Then** row flips to `pending` and exactly one new job enqueued (architecture §5.5)

**Given** row `status=pending` and worker stuck
**When** UI polls or user retries
**Then** does not create duplicate operations or duplicate Linear issues

**Given** unit/integration test
**When** parallel `pushReportToLinear` calls simulated
**Then** at most one Linear GraphQL create executes (architecture §18 FR-21)

**Technical notes:** Table `integration_operations` columns: `status` enum `pending|succeeded|failed`, `external_id`, `external_url`, `error`. Playwright item 3: ⌘K push concurrent dedupe.

**Dependencies:** E7-S2.

---

## Story E7-S4: Linear push UX — single, palette, and errors

As a developer triaging a report,
I want push from detail, keyboard, and palette with actionable errors,
So that Linear integration feels native (FR-21, LG-4).

**Acceptance Criteria:**

**Given** report detail header
**When** user clicks Push or presses `p`
**Then** mutation runs with toast on success; Linear icon + URL in header (EXPERIENCE.md)

**Given** Linear token expired
**When** push fails
**Then** inline Alert "Linear token expired." with Reconnect button → OAuth (EXPERIENCE.md, UJ-1 edge)

**Given** Playwright test
**When** ⌘K push with mocked Linear
**Then** issue URL visible on report (architecture §13 item 3)

**Technical notes:** Complements E3-S6 bulk push. Developer+ role. Issue title prefixed `[UBR]` per EXPERIENCE.md Flow 1.

**Dependencies:** E7-S2, E3-S7, E3-S9.
