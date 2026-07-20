---
baseline_commit: cd3ba44
depends_on:
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
blocks:
  - 8-2-webhook-dispatch-and-hmac-delivery
---

# Story 8.1: Webhook registration with Pro tier gate

Status: review

## Story

As a workspace admin on Pro tier,
I want to register HTTPS webhook endpoints for report events,
so that automations react to new and updated reports.

## Acceptance Criteria

1. `WebhookService.register` persists endpoints with org scope.
2. Free tier rejected at service layer with FORBIDDEN.
3. `http://` URLs rejected — HTTPS only.
4. Settings UI at `/w/[slug]/settings/webhooks`.

## Dev Agent Record

- schema `webhook_endpoints`, service + REST routes + settings page.
