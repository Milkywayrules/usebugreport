---
generated: 2026-07-20
project: usebugreport
verdict: READY_WITH_FIXES_APPLIED
scope: launch E1-E9 (48 stories) + fast-follow E10-E11 (5 stories)
tracking: sprint-status.yaml
---

# Sprint Plan — usebugreport v1.0 Launch

Dependency-ordered execution batch for AI dev agents working one story at a time. "Sprint" = a batch that can run start-to-finish without blocking on unimplemented dependencies.

## Sequencing Mandates Applied

| Mandate | How honored |
| --- | --- |
| Greenfield: monorepo first | **E1-S1** is queue position 1 |
| Auth + schema before dependents | **E4-S1** → **E2-S1** → **E4-S6** foundation chain |
| UsageService before workspace CRUD | **E4-S6** precedes **E4-S3** |
| AD-10 shortcut registry before palette | **E3-S10** precedes **E3-S9** |
| E6 before E5 (readiness note) | **E6-S1..S4** complete before **E5-S1** |
| E7 outbox before bulk Linear | **E7-S2** before **E3-S6** |
| Fast-follow separated | E10-E11 after all E1-E9 stories |

## Parallel Lanes (front of queue)

| After completed | Safe parallel lanes | Count |
| --- | --- | ---: |
| E1-S1 | E4-S1 only | **1** |
| E4-S1 | E2-S1, E4-S2, E1-S2, E3-S1 | **4** |
| E2-S1 + E4-S1 | above minus E2-S1 → add E4-S6 | **4** |
| E4-S6 + E4-S3 chain | E1-S2..S4, E3-S1/S3, E2-S2 (after E4-S3) | **3–4** |

**Recommendation:** default **1 lane** (sequential) for greenfield coherence; scale to **4 lanes** only after E4-S1 when foundation paths are stable.

---

## Launch Queue (E1–E9, 48 stories)

| # | Story | Epic | Key | Depends on | Why here |
| ---: | --- | --- | --- | --- | --- |
| 1 | E1-S1 | E1 | `1-1-monorepo-scaffold-and-capture-packages` | — | Greenfield entry: turborepo, apps, packages |
| 2 | E4-S1 | E4 | `4-1-better-auth-github-oauth-and-session` | E1-S1 | Auth before any tenant-scoped work |
| 3 | E2-S1 | E2 | `2-1-core-ingest-schema-and-queue-payloads` | E1-S1, E4-S1 | DB schema + BullMQ refs before ingest |
| 4 | E4-S6 | E4 | `4-6-usageservice-tier-limits-at-service-boundary-ad-11` | E4-S1, E2-S1 | AD-11 tier stubs; needs `workspace_usage_monthly` |
| 5 | E4-S2 | E4 | `4-2-onboarding-gate-middleware` | E4-S1 | Onboarding gate; ∥ with E4-S6 after E4-S1 |
| 6 | E4-S3 | E4 | `4-3-workspace-and-project-crud-with-ingest-keys` | E4-S1, E4-S6 | Workspace CRUD + ingest keys after UsageService |
| 7 | E4-S4 | E4 | `4-4-project-level-rbac` | E4-S3 | RBAC requires projects |
| 8 | E4-S5 | E4 | `4-5-workspace-api-key-management` | E4-S1, E4-S4 | API keys need RBAC boundaries |
| 9 | E1-S2 | E1 | `1-2-instant-replay-buffer-and-privacy-plugins` | E1-S1 | SDK capture core; ∥ after scaffold |
| 10 | E1-S3 | E1 | `1-3-screenshot-and-environment-metadata-at-submit` | E1-S2 | Metadata layer on buffer |
| 11 | E1-S4 | E1 | `1-4-publishable-usebugreport-browser-sdk-package` | E1-S2, E1-S3 | Publishable npm package |
| 12 | E3-S1 | E3 | `3-1-web-app-shell-theme-and-route-scaffold` | E4-S1 | Web shell + onboarding middleware |
| 13 | E3-S3 | E3 | `3-3-workspace-switcher-and-pinned-workspaces` | E3-S1, E4-S1 | Workspace switcher needs auth |
| 14 | E2-S2 | E2 | `2-2-presign-and-complete-ingest-path` | E2-S1, E4-S3 | Presign needs ingest_keys from E4-S3 |
| 15 | E2-S3 | E2 | `2-3-inline-ingest-path-with-ack-latency-measurement` | E2-S2 | Inline path extends presign routes |
| 16 | E2-S4 | E2 | `2-4-ingest-finalize-worker` | E2-S2, E2-S3 | Worker finalize after both ingest paths |
| 17 | E2-S5 | E2 | `2-5-reportservice-metadata-reads-and-replay-manifest` | E2-S4 | ReportService reads after finalize |
| 18 | E2-S6 | E2 | `2-6-usage-quotas-and-ingest-rate-limits` | E2-S4, E4-S6 | Quotas at ingest boundary (AD-9) |
| 19 | E2-S7 | E2 | `2-7-retention-sweep-and-stale-pending-cleanup` | E2-S4, E4-S6 | Tier retention authority (LG-11) |
| 20 | E2-S8 | E2 | `2-8-worker-container-ops-memory-rss-concurrency-graceful-shutdown` | E2-S4 | Worker ops after ingest jobs exist |
| 21 | E1-S5 | E1 | `1-5-sdk-submit-widget-shadow-dom` | E1-S4, E2-S2 | Widget calls presign/inline endpoints |
| 22 | E3-S2 | E3 | `3-2-onboarding-wizard` | E3-S1, E4-S3 | Onboarding creates org/project |
| 23 | E3-S4 | E3 | `3-4-dense-report-list-with-keyboard-navigation` | E2-S5, E3-S1 | List needs ReportService + shell |
| 24 | E3-S7 | E3 | `3-7-report-detail-and-replay-viewer` | E2-S5, E3-S1 | Replay viewer needs manifest API |
| 25 | E3-S10 | E3 | `3-10-central-keyboard-shortcuts-registry` | E3-S4 | **AD-10:** registry before palette |
| 26 | E3-S5 | E3 | `3-5-bulk-status-change` | E3-S4, E2-S5 | Bulk status on list + ReportService |
| 27 | E3-S8 | E3 | `3-8-human-web-comments-fr-26-lg-2` | E3-S7, E4-S4 | Comments on detail + RBAC; seeds CommentService |
| 28 | E3-S9 | E3 | `3-9-command-palette-cmd-k` | E3-S4, E3-S10 | Palette consumes SHORTCUTS registry |
| 29 | E6-S1 | E6 | `6-1-domain-services-and-ad-1-lint-gate` | E2-S5 | AD-1 lint gate on shared services |
| 30 | E6-S2 | E6 | `6-2-surface-registry-and-route-validation` | E6-S1 | Surface registry (AD-2) |
| 31 | E6-S3 | E6 | `6-3-rest-report-endpoints` | E6-S2, E4-S5 | REST routes need API keys + registry |
| 32 | E6-S4 | E6 | `6-4-rest-parity-contract-tests-real-http` | E6-S3 | REST parity tests (LG-6) |
| 33 | E7-S1 | E7 | `7-1-linear-oauth-and-integrationservice-config` | E4-S4, E4-S6 | Linear OAuth + tier integration limit |
| 34 | E7-S2 | E7 | `7-2-outbox-backed-linear-push-worker` | E7-S1, E2-S5 | Outbox push worker |
| 35 | E7-S3 | E7 | `7-3-outbox-pending-and-failed-conflict-branches` | E7-S2 | Race-safe outbox branches |
| 36 | E3-S6 | E3 | `3-6-bulk-linear-push` | E3-S5, E7-S2 | Bulk Linear gated on outbox |
| 37 | E7-S4 | E7 | `7-4-linear-push-ux-single-palette-and-errors` | E7-S2, E3-S7, E3-S9 | Single/palette push UX |
| 38 | E5-S1 | E5 | `5-1-mcp-streamable-http-transport-and-auth` | E4-S5, E6-S1 | **E6 before E5:** MCP auth on services |
| 39 | E5-S2 | E5 | `5-2-mcp-read-tools-from-surface-registry` | E5-S1, E6-S2 | MCP tools from registry |
| 40 | E5-S3 | E5 | `5-3-mcp-parity-contract-tests-streamable-http` | E5-S2, E6-S4 | MCP Streamable HTTP parity |
| 41 | E8-S1 | E8 | `8-1-webhook-registration-with-pro-tier-gate` | E4-S6, E2-S4 | Webhooks need finalize + tier gate |
| 42 | E8-S2 | E8 | `8-2-webhook-dispatch-and-hmac-delivery` | E8-S1, E2-S4 | Dispatch after registration |
| 43 | E8-S3 | E8 | `8-3-ssrf-controls-with-ip-pinning-at-delivery` | E8-S2 | SSRF IP pinning on delivery |
| 44 | E8-S4 | E8 | `8-4-webhook-debug-ui` | E8-S2, E3-S1 | Debug UI in settings shell |
| 45 | E9-S1 | E9 | `9-1-deletion-tombstone-enqueue-and-key-revocation` | E4-S1, E3-S1 | GDPR tombstone + danger UI shell |
| 46 | E9-S2 | E9 | `9-2-external-purge-r2-and-redis-before-postgres` | E9-S1, E2-S4 | R2 purge before Postgres (AD-8) |
| 47 | E9-S3 | E9 | `9-3-postgres-purge-last-with-idempotent-step-resume` | E9-S2 | Postgres purge last |
| 48 | E9-S4 | E9 | `9-4-gdpr-e2e-and-deletion-status-ux` | E9-S1, E9-S2, E9-S3 | LG-7 Playwright E2E |

---

## Fast-Follow Queue (E10–E11, 5 stories)

Post v1.0 launch — **not LG gates**. Blocked until launch queue complete.

| # | Story | Epic | Key | Depends on | Why here |
| ---: | --- | --- | --- | --- | --- |
| FF-1 | E10-S1 | E10 | `10-1-rest-and-mcp-create-comment-via-commentservice` | E3-S8, E6-S2, E5-S1 | Agent `create_comment` (FR-16); reuses CommentService |
| FF-2 | E10-S2 | E10 | `10-2-web-thread-attribution-for-agent-comments` | E10-S1 | API key attribution in web thread |
| FF-3 | E11-S1 | E11 | `11-1-linear-inbound-status-sync` | E7-S2 | Linear inbound (FR-24) needs outbound link |
| FF-4 | E11-S2 | E11 | `11-2-github-issues-outbound-push` | E7-S3 | GitHub push reuses outbox pattern |
| FF-5 | E11-S3 | E11 | `11-3-report-comment-created-webhook-ff-4` | E10-S1, E8-S2 | Comment webhook (FF-4) after agent write |

---

## Validation Summary

| Check | Result |
| --- | --- |
| Launch stories | 48 / 48 queued |
| Fast-follow stories | 5 / 5 queued |
| Epics with retrospective | 11 / 11 |
| E6 before E5 | ✓ positions 29–32 before 38–40 |
| E3-S10 before E3-S9 | ✓ positions 25 before 28 |
| E4-S6 before E4-S3 | ✓ positions 4 before 6 |
| Orphan keys in sprint-status | 0 |

## Downstream Agent Usage

1. **create-story** — picks first `backlog` story in `sprint-status.yaml` (top-to-bottom order).
2. **dev-story** — picks first `ready-for-dev` story in same order.
3. Update story status as work progresses: `backlog` → `ready-for-dev` → `in-progress` → `review` → `done`.

**Tracking file:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
