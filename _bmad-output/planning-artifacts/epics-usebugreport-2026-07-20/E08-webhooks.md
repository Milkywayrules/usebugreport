# Epic E8: Outbound Webhooks

**Goal:** Pro+ webhook registration, HMAC delivery, SSRF IP pinning, debug UI (LG-10).

**FRs:** FR-19 | **ADs:** AD-5, AD-11

---

## Story E8-S1: Webhook registration with Pro tier gate

As a workspace admin on Pro tier,
I want to register HTTPS webhook endpoints for report events,
So that automations react to new and updated reports (FR-19).

**Acceptance Criteria:**

**Given** `/w/[slug]/settings/webhooks`
**When** admin saves endpoint URL and events `report.created`, `report.updated`
**Then** `WebhookService.register` persists `webhook_endpoints` with org scope (FR-19)
**And** `UsageService.checkTierLimit('webhooks')` allows Pro+, rejects Free at **service layer** (AD-11)

**Given** Free tier workspace
**When** register attempted via API or UI
**Then** HTTP 403 `FORBIDDEN` — not UI-only gate

**Given** `http://` URL
**When** registration attempted
**Then** rejected — HTTPS only (architecture §8 SSRF)

**Technical notes:** Scope `webhooks:manage` on API keys. Launch events only — `report.comment.created` deferred E11-S3.

**Dependencies:** E4-S6, E2-S4 (dispatch trigger).

---

## Story E8-S2: Webhook dispatch and HMAC delivery

As a webhook consumer,
I want signed payloads with exponential backoff retries,
So that I can verify and recover from transient failures (FR-19).

**Acceptance Criteria:**

**Given** `ingest.finalize` completes or report status updates
**When** `WebhookService.dispatchEvent` runs
**Then** fan-out enqueues `webhooks.deliver` per matching `webhook_endpoints` (architecture §4 queues)

**Given** delivery attempt
**When** HTTP POST executed
**Then** headers include `X-UseBugReport-Signature: sha256=...` and `X-UseBugReport-Timestamp` over `${timestamp}.${rawBody}` (FR-19, architecture §8)
**And** attempts logged in `webhook_deliveries` with status, response code, `next_attempt_at`
**And** retry schedule: immediate, 1m, 5m, 30m, 2h — then failed at 24h (architecture §8)

**Technical notes:** Worker `apps/worker/src/jobs/webhooks.ts`. At-least-once delivery; idempotent consumer guidance in docs (PRD §8.3).

**Dependencies:** E8-S1, E2-S4.

---

## Story E8-S3: SSRF controls with IP pinning at delivery

As the platform,
I want webhook delivery to block private networks and pin resolved IPs,
So that SSRF and DNS rebinding cannot attack internal services (architecture §8 board mandate).

**Acceptance Criteria:**

**Given** webhook URL registration
**When** DNS resolves
**Then** resolved IP validated against deny ranges: loopback, RFC1918, link-local, metadata `169.254.169.254`, CGNAT `100.64.0.0/10` (architecture §8)

**Given** delivery time (TOCTOU window)
**When** `WebhookService.deliver` runs
**Then** hostname resolved again, IP re-validated, connection **pinned** to validated IP with `Host` header and TLS SNI to original hostname (architecture §8 board mandate)

**Given** SSRF check fails
**When** delivery attempted
**Then** delivery marked `failed`; **no retry** (architecture §8)

**Given** redirect response
**When** received
**Then** redirect following disabled — single-hop only (architecture §8)

**Given** integration test with private IP URL
**When** register or deliver
**Then** blocked at service layer

**Technical notes:** Connect timeout 5s, total 30s. Failed SSRF → `webhook_deliveries.status=failed`.

**Dependencies:** E8-S2.

---

## Story E8-S4: Webhook debug UI

As a workspace admin,
I want a delivery log in settings,
So that I can debug failed webhook deliveries (FR-19).

**Acceptance Criteria:**

**Given** `/w/[slug]/settings/webhooks`
**When** admin views delivery log Table
**Then** rows show event, endpoint, status, attempts, last response code, timestamp (EXPERIENCE.md)

**Given** failed delivery
**When** expanded
**Then** shows error summary without leaking signed secret

**Technical notes:** Read from `webhook_deliveries` joined to `webhook_endpoints`. Admin role required.

**Dependencies:** E8-S2, E3-S1 (settings shell).
