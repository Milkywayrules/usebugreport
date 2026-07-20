---
baseline_commit: ce7015f
depends_on:
  - 8-2-webhook-dispatch-and-hmac-delivery
blocks: []
---

# Story 8.3: SSRF controls with IP pinning at delivery

Status: review

## Dev Agent Record

- `webhook-ssrf.ts` validates deny ranges at registration and re-validates at delivery with pinned HTTPS fetch.
