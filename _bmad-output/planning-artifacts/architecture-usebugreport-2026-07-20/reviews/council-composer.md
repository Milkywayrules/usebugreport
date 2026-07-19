# Council Verdict — Composer 2.5 Fast (Decision Delegate)

**Date:** 2026-07-20  
**Documents reviewed:** ARCHITECTURE-SPINE.md, architecture.md, prd.md  
**Scope:** v1 architecture approval before epic/story creation (A–D)

---

**YES_WITH_NOTES**:

Approve the v1 architecture as the basis for epics and stories, conditioned on three explicit story-level carryovers: (1) tier enforcement for workspace count (Free 1 / Pro 5) and Pro-only webhooks must become AD-level or epic acceptance criteria — they are in the PRD but absent from spine invariants; (2) FR-26 web comments need a named session-auth route/handler in E3 even though they correctly bypass the MCP/REST surface registry; (3) bulk Linear push (FR-11) must appear in E3 stories, not only single-report ⌘K. On sub-decisions: accept 15-min presigned R2 URLs for v1 (B), accept the six-container topology with separate worker (C), and accept hand-rolled surface-registry + parity contract tests over elysia-mcp auto-expose (D).

**Reasoning**:

- **A — Launch gates & FR coverage:** All 11 launch gates (LG-1..LG-11) map cleanly to epics E1–E9 with AD bindings. All 26 FRs are either architecturally addressed or correctly deferred (FR-16/24/25 fast-follow). Shared service layer (AD-1), async ingest (AD-4), tenancy scoping (AD-3), GDPR cascade (AD-8), and keyboard registry (AD-10) are the right invariants for the five founder pillars.
- **A — Gaps (non-blocking):** Workspace-per-tier caps (FR-8), Pro-only webhook gating (FR-19), and Free-tier integration limit (monetization §9) are implied by `billing_tier` but not enforced by any AD rule — easy to miss in implementation without epic AC. FR-26 web comments are launch-gate (LG-2) but architecture only details CommentService; the session-scoped web path is underspecified relative to the registry-heavy MCP/REST story.
- **A — Corner-painting check:** Postgres FTS (AD-7) and single EU VPS are PRD-assumed and have documented deferral paths — acceptable. Presigned-only blob serving (AD-6) is harder to reverse than proxy but matches FR-6 ("signed URL **or** proxied stream") and VPS economics. Prefix external IDs and cursor pagination are fine. The one real v1 risk is presigned URL leakage (see B), not structural deadlock.
- **B — Presigned URLs:** Reject proxied streaming for v1. On a single 12GB Contabo box, proxying multi-MB gzip replay batches would compete with API/MCP latency (LG-6, SM-6) and ingest ack SLA (200ms p95). FR-6 explicitly permits signed URLs. Mitigation is correct: RBAC on manifest issuance, 15-min TTL, CORS on R2. Residual risk — copied URL works without re-auth for TTL — is acceptable for authenticated team triage at launch; not equivalent to public recording links (deferred v2.0). GDPR deletion invalidates objects at R2; presigned URLs to deleted keys fail. Revocation lag for demoted users is bounded by TTL, not indefinite.
- **C — Separate worker container:** Accept six containers. Rough memory budget (~Postgres 1GB, Redis 256MB, web 512MB–1GB, api 256–512MB, worker 256–512MB, Caddy negligible) leaves comfortable headroom on 12GB for early scale (PRD A-5: 100 paying workspaces). CPU isolation for gzip/R2 writes is worth ~300MB versus folding worker into api — ingest back-pressure and MCP p95 are launch-sensitive. Defer in-process BullMQ (already listed in Deferred) unless production metrics prove worker idle; do not pre-optimize the other direction.
- **D — Surface registry + contract tests:** Accept hand-rolled registry over elysia-mcp auto-expose. MCP+REST parity is LG-5/LG-6 and the stated competitive moat; auto-expose produces coarse tool schemas and hides drift — exactly what FR-18's integration tests are meant to prevent. Launch read surface is ~7 tools; registry overhead is O(days), not O(months). Build-time route/MCP validation plus `parity.test.ts` is proportionate enforcement, not gold-plating.

**Additional from me**:

- Add **AD-11 (or epic AC)** before story breakdown: enforce `billing_tier` limits — workspace count, webhook registration (Pro+), integration count (Free: 1) — at service boundary, not only UI.
- Epic **E3** must include: web comment composer (session auth → CommentService), bulk status change, bulk Linear push — architecture mentions optimistic status updates but not bulk tracker push.
- Epic **E2/E3** story for replay manifest: document that `getReplayManifest` re-validates project RBAC on every call; presigned URLs must never be cached client-side beyond TTL; consider 5-min TTL if security review flags 15-min as loose for agency multi-client use.
- Epic **E5/E6**: parity tests must cover error envelopes and scope denial (Free tier write rejection), not only happy-path JSON equality.
- Ops story in **E2**: define worker memory/concurrency limits and Coolify alerts — 12GB is sufficient but not generous if Postgres grows or replay payloads trend heavy.
- Do **not** reopen B/C/D during epic creation unless load-test on staging shows worker RSS >1GB sustained or manifest leak in pen test — those are the only triggers that would flip presigned or topology decisions.
