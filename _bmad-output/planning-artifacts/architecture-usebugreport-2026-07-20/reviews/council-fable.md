# Council verdict — Fable delegate

Review of `ARCHITECTURE-SPINE.md` + `architecture.md` against `prd-usebugreport-2026-07-20/prd.md` (26 FRs, LG-1..LG-11). Questions ruled: A (approve as epic basis), B (presigned vs proxied replay), C (separate worker container), D (explicit MCP surface registry).

---

**YES_WITH_NOTES**:
Approve the architecture as the basis for epics/stories. A: approved — all 11 launch gates and all 26 FRs trace to a concrete home (service, table, route, or AD invariant), and no invariant paints us into a corner. B: keep presigned R2 URLs as decided. C: keep the separate worker container; do not fold into api. D: keep the explicit surface registry + contract tests; reject elysia-mcp auto-expose.

**Reasoning**:

- A — coverage verified gate by gate: LG-1→AD-4/AD-5/AD-9 + ingest pipeline §4; LG-2→rrweb-player integration + `report_comments`/`CommentService`; LG-3→better-auth org plugin + `project_members` RBAC matrix §6; LG-4→`IntegrationService` + AD-5 idempotent push; LG-5→all six read tools present in the surface registry including `search_reports`; LG-6→AD-1/AD-2 + parity tests; LG-7→AD-8 ordered deletion cascade §9; LG-8→AD-9 quota/rate-limit boundary; LG-9→AD-10 shortcut registry + §10 frontend; LG-10→§8 webhooks with HMAC + retry schedule matching FR-19; LG-11→§7 dual retention enforcement. The FR sweep (FR-1..FR-26) found no orphans — deferred FRs (16, 24, 25) are correctly labeled fast-follow.
- A — invariants are sound. AD-1/AD-2 (service layer + registry) is the strongest part of the document: it makes the MCP/REST parity launch gate mechanically enforceable rather than a code-review promise. AD-6's "no proxy" rule binds only replay bytes, so it does not block serving console/network JSON through the API; AD-7 (Postgres FTS) and the deferred table show correct YAGNI discipline.
- B — presigned is the right call on a single 12GB Contabo VPS. Proxying multi-MB rrweb batches through one Bun process burns VPS bandwidth and event-loop time the box cannot spare, while R2 egress to the internet is free. Authorization happens at manifest issuance, which runs full RBAC on every call; a leaked URL exposes one object for ≤15 minutes. That is the same posture Sentry and Linear take on attachment URLs, and it is acceptable for the v1 threat model given SM-C3. Proxied streaming buys revocation-lag elimination we don't need at the cost of the exact resource that is scarcest.
- C — folding the worker into api saves roughly 200–300MB of a 12GB budget (six containers total well under 4GB steady state) but couples CPU-heavy gunzip/gzip and R2 multipart streaming to the same single-threaded Bun event loop that must hit the <200ms ingest ack (PRD §8.1) and <2s MCP p95 (SM-6). The isolation is precisely what protects SM-5/SM-6 under ingest bursts, and it gives independent restart/deploy. Memory is not the constraint here; latency isolation is. The deferred table already keeps in-process workers as a documented fallback if the container proves unnecessary.
- D — elysia-mcp auto-expose would produce coarse REST-shaped tool schemas, but the product moat is curated, token-efficient tools (`get_report_summary` exists specifically for LLM consumption). The hand-rolled surface is ~8 registry entries — trivial to maintain — and the registry doubles as the single source of truth for the parity tests that are themselves launch gate LG-6. Pinning the official `@modelcontextprotocol/sdk` v1.x also satisfies the PRD §8.2 pinning requirement; a young community wrapper does not.

**Additional from me**:

- FR-26 trap: the registry marks `comments.create` as `launchGate: false` (FF-1), but human web comments are launch gate LG-2. Epic creation must explicitly ship session-authenticated comment create + list routes at v1.0 so the FF-1 label doesn't silently defer the web composer. The architecture's parenthetical "(FF-1 for API; web uses session path at v1)" is too thin — make it a story.
- Per-org R2 lifecycle rules (`{orgId}/` prefix with tier-specific expiry) hit bucket rule limits as orgs grow and require API churn on every tier change. Make `retention.sweep` the source of truth for tiered deletion; keep one bucket-wide conservative safety rule (max tier retention + the 1-day multipart abort) instead of per-org rules.
- Spell out in epics that `getConsoleLogs`/`getNetworkRequests` fetch `console.json.gz`/`network.json.gz` from R2 server-side, decompress, and filter. AD-6 prohibits proxying replay bytes only — don't let stories misread it as prohibiting all API-side R2 reads, or these two launch-gate tools have no data source.
- AD-9 has a small quota race: quota is checked before enqueue but incremented on job completion, so concurrent submits can overshoot the Free 30 cap by the in-flight count. Accept it or count pending reports in `checkQuota`; do not build distributed locking for this.
- AD-2 says routes are "generated or validated" from the registry — pick validate-only. Code generation for eight operations is build machinery YAGNI; the validation script + parity test is enough.
- Minor enforcements with no stated home — place them during epic creation: workspace-count-per-tier (Free 1 / Pro 5) at org creation, Pro+ gating on webhook registration (FR-19), CSP headers (PRD §8.2), and a consumer for `GET /metrics` (no scraper exists in the topology — either accept Coolify-notification alerting only for v1 or drop the endpoint until something scrapes it).

---

_Delegate: Fable 5 · 2026-07-20 · file written per council protocol so verdict survives session loss._
