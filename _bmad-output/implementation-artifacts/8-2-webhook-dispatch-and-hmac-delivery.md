---
baseline_commit: ce7015f
depends_on:
  - 8-1-webhook-registration-with-pro-tier-gate
blocks:
  - 8-3-ssrf-controls-with-ip-pinning-at-delivery
---

# Story 8.2: Webhook dispatch and HMAC delivery

Status: review

## Story

As a webhook consumer,
I want signed payloads with exponential backoff retries,
so that I can verify and recover from transient failures.

## Dev Agent Record

- `WebhookService.processDispatchJob` / `processDeliverJob` with HMAC headers and delivery log rows.
- `apps/worker/src/jobs/webhooks.ts` handles `webhooks.dispatch` and `webhooks.deliver`.
