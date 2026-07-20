---
baseline_commit: b5e7a7e
depends_on:
  - 8-2-webhook-dispatch-and-hmac-delivery
  - 8-3-ssrf-controls-with-ip-pinning-at-delivery
blocks: []
---

# Story 8.4: Webhook debug UI

Status: review

## Story

As a workspace admin,
I want a delivery log in settings,
so that I can debug failed webhook deliveries (FR-19).

## Dev Agent Record

- `WebhookService.listDeliveries` joins `webhook_deliveries` to endpoints for the active org (admin-only).
- `GET /api/v1/webhooks/deliveries` and settings delivery log table with expandable failure summaries.
