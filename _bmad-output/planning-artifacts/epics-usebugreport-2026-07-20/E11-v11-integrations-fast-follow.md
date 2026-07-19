# Epic E11: v1.1 Integrations (Fast-follow)

**Scope:** Committed v1.1 — **not v1.0 launch.** Out of LG-1..LG-11.

**FRs:** FR-24, FR-25, FR-19 (comment webhook FF-4) | **Epic E11 per PRD §13**

---

## Story E11-S1: Linear inbound status sync

As a workspace using Linear,
I want report status updated when linked issue status changes,
So that triage state stays aligned with the tracker (FR-24).

**Acceptance Criteria:**

**Given** Linear webhook configured per workspace
**When** linked issue status changes
**Then** inbound handler verifies signature via `@linear/sdk/webhooks` (FR-24)
**And** `ReportService.updateStatus` maps Linear state → report status enum per workspace config (FR-24)

**Given** report without Linear link
**When** webhook received
**Then** no-op; 200 ack

**Technical notes:** New route e.g. `POST /api/v1/integrations/linear/webhook`. Does not use outbound outbox pattern — inbound only. Status mapping table or JSON on `integrations` row.

**Dependencies:** E7-S2 (Linear link on report). **v1.1 only.**

---

## Story E11-S2: GitHub Issues outbound push

As a workspace admin,
I want to push reports to GitHub Issues,
So that secondary tracker users are supported (FR-25 — council committed v1.1).

**Acceptance Criteria:**

**Given** GitHub App OAuth connected
**When** user pushes report (UI + API parity with Linear push pattern)
**Then** `IntegrationService` uses `integration_operations` outbox with `action='github.push'` and same pending/succeeded/failed semantics as E7-S3 (architecture §5.5)

**Given** issue created
**When** success
**Then** body includes report link and summary excerpt (FR-25)

**Technical notes:** Reuse outbox UNIQUE `(report_id, action)` pattern. GitHub not in v1 launch UI — add settings route when shipped.

**Dependencies:** E7-S3 (outbox pattern). **v1.1 only.**

---

## Story E11-S3: report.comment.created webhook (FF-4)

As a Pro workspace automation,
I want webhooks when comments are created,
So that agents and CI react to new thread activity (FR-19 FF-4).

**Acceptance Criteria:**

**Given** E10-S1 shipped
**When** comment created via web session or API key
**Then** `WebhookService.dispatchEvent('report.comment.created')` fires (PRD §6.2 FF-4)

**Given** webhook registration UI
**When** admin selects events
**Then** `report.comment.created` available in MultiSelect alongside existing launch events

**Given** delivery
**When** sent
**Then** same HMAC and SSRF controls as E8-S2/S3 (architecture §8)

**Technical notes:** Depends on `CommentService.create` from both web and v1 API paths. Not part of LG-10 launch events.

**Dependencies:** E10-S1, E8-S2. **v1.1 / FF-4.**

---

_FF-5 assignee bulk assign: deferred sketch only (PRD §14) — no story ID._
