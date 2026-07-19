---
title: usebugreport
status: final
created: 2026-07-20
updated: 2026-07-20T06:00
---

# PRD: usebugreport

## 0. Document Purpose

This PRD defines v1.0 launch requirements for **usebugreport** — a bug-reporting and session-capture SaaS by Verasic Labs. Primary readers: product, engineering, UX, and downstream architecture/epics workflows. Vocabulary is anchored in §3 Glossary; functional requirements use globally numbered IDs (FR-1…FR-N); success metrics use SM-* IDs.

Inputs synthesized: product brief (`brief-usebugreport-2026-07-20`), brief addendum, market research, and technical architecture research. **Council settlements** (ratified 2026-07-20) override brief/addendum where they conflict; reconciliation notes appear in §6.3 and §12.

Technical stack choices and transport details live in `addendum.md`, not here.

---

## 1. Vision

**usebugreport** is the bug-reporting OS for AI-augmented builders. Humans file rich, privacy-respecting reports in seconds from embedded apps; the same **Workspace** data is readable and searchable by AI agents via MCP and REST with identical capability. A keyboard-first web app (Linear-grade density, ⌘K command palette) serves the person who files *and* triages bugs — freelancers juggling client **Projects**, agency leads, and in-house QA teams.

The category is crowded (Jam, Marker.io, BetterBugs, Crikket), but differentiation in 2026 sits at the intersection of **agent-native API depth**, **superuser triage UX**, and **workspace-per-client multi-tenancy** — not raw capture mechanics. Capture uses industry-standard rrweb instant replay (2-minute buffer, console + network); the moat is execution: MCP + REST parity, history-aware `search_reports`, per-**Workspace** integration profiles, and keyboard-dense triage.

v1 ships the smallest vertical slice honoring all five founder pillars: (1) superuser keyboard UX, (2) API-first integrations, (3) AI-agent-native MCP + REST, (4) full human web app, (5) multi-tenant **Workspaces** / **Projects**. Chrome extension, recording links, video capture, and support-suite features are explicitly deferred.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **File fast:** Capture a reproducible bug with replay, console, network, and screenshot in under 30 seconds without leaving the keyboard workflow.
- **Triage at speed:** Bulk status changes, push to **Linear**, and navigate report queues with ⌘K and vim-style list navigation; assignee bulk actions ship v1.1 (FF-5).
- **Agent in the loop:** Let Cursor, Claude Code, or Telegram Hermes agents list, search, summarize, and comment on **Reports** via MCP or REST without custom glue.
- **Multi-client isolation:** Freelancers and agencies maintain one login with per-client **Workspaces**, each with its own integration profile and ingest keys.
- **Compliance-ready capture:** Opt-in, on-**Report**-only replay; configurable retention; GDPR cascading deletion for EU buyers.

### 2.2 Non-Users (v1)

- Enterprise buyers requiring self-serve SSO/SCIM (sales-assisted later).
- Teams needing always-on session replay or full observability (Highlight/LaunchDarkly territory).
- Mobile-native capture buyers (Gleap/Instabug dominate; web-first wedge).
- Support-suite buyers wanting live chat, NPS, and customer portals (Gleap/Usersnap path).
- Jira-only shops with no interest in agent API or keyboard triage (IssueCapture serves them better today).

### 2.3 Key User Journeys

**UJ-1. Maya files a client bug from staging without breaking flow.**

- **Persona + context:** Maya, freelance full-stack dev with six active client **Workspaces**, uses Cursor daily.
- **Entry state:** Authenticated in client staging app where `@usebugreport/browser` SDK is embedded; 2-minute replay buffer already recording locally (privacy-default, no always-on server recording).
- **Path:** Reproduces checkout bug → triggers SDK submit (keyboard shortcut or widget) → SDK attaches screenshot, console errors, failed network calls, environment metadata → **Report** created in active client **Project** → Maya switches **Workspace** via ⌘+number → opens report in web app → ⌘K → "Push to Linear" → issue created in client's Linear team.
- **Climax:** Linear issue URL appears on **Report** detail; agent context available immediately via `get_report_summary`.
- **Resolution:** Maya returns to coding; Hermes bot can `list_reports` for today's queue overnight.
- **Edge case:** Ingest rate limit hit on Free tier → clear error with upgrade path; replay still buffered locally until quota resets.

**UJ-2. Agency Apex triages today's cross-client queue.**

- **Persona + context:** Lead dev at 12-person shop, 20 concurrent client **Projects**.
- **Entry state:** Authenticated in web app; active **Workspace** set to agency home org.
- **Path:** Opens dense report list filtered to "today" → j/k navigation → bulk select → status → open → replay viewer + console panel → ⌘K push selected **Reports** to each **Workspace**'s configured Linear integration.
- **Climax:** All open staging bugs visible and actionable without mouse-heavy forms.
- **Resolution:** Developers receive Linear notifications; **Reports** retain sync link to external issue.
- **Edge case:** Linear OAuth token expired → inline re-auth prompt on push; **Report** stays in queue.

**UJ-3. In-house QA lead searches regression history via agent.**

- **Persona + context:** QA lead at 40-person product org, SOC 2 pressure on retention.
- **Entry state:** Cursor agent session with **Workspace API Key** scoped to product org.
- **Path:** Agent calls `search_reports` with query "checkout null TypeError" + date filter → receives ranked **Report** IDs → `get_report_summary` on top 3 → human confirms duplicate → status bulk-updated in web app.
- **Climax:** Regression pattern identified across releases without manual scrolling.
- **Resolution:** Duplicate **Reports** linked in comments; primary **Report** pushed to Linear.
- **Edge case:** Search returns no matches → agent falls back to `list_reports` with status=open filter.

**UJ-4. GDPR data subject requests workspace deletion.**

- **Persona + context:** EU client admin after contract ends.
- **Entry state:** Authenticated as **Workspace** owner in settings.
- **Path:** Initiates **Workspace** deletion → confirmation with retention summary → system enqueues cascading deletion job → Postgres rows, R2 blobs, API keys, integration tokens, webhook subscriptions removed within SLA.
- **Climax:** Deletion certificate/log available to owner; no orphaned blobs in R2.
- **Resolution:** **Workspace** slug released; audit entry retained per legal minimum.

---

## 3. Glossary

- **Workspace** — Top-level tenant boundary mapped to a better-auth **Organization**. Holds members, billing tier, integration configs, and API keys. Cardinality: 1 user may belong to N Workspaces.
- **Project** — Application boundary within a **Workspace**. Holds ingest keys, project-level RBAC, and **Reports**. Cardinality: 1 Workspace has N Projects.
- **Report** — A submitted bug capture: metadata in Postgres, replay/console/network/screenshot blobs in R2. Created only on explicit user submit (never always-on).
- **Instant Replay** — Up to 2 minutes of rrweb DOM replay buffered client-side until **Report** submit.
- **Ingest Key** — Project-scoped, write-only public key (`ubr_ingest_*`) for SDK capture endpoints; rate-limited.
- **Workspace API Key** — Organization-scoped secret (`ubr_live_*`) for MCP/REST read/write per permissions; never embedded in browser.
- **MCP** — Model Context Protocol server at `/mcp` (Streamable HTTP); tool surface mirrors REST capabilities via shared service layer.
- **REST API** — Versioned HTTP API at `/api/v1`; OpenAPI 3.1 documented.
- **Shared Service Layer** — Domain services (ReportService, CaptureIngestService, etc.) invoked by both MCP tools and REST handlers; sole source of business logic.
- **Launch Gate** — Requirement that must ship before v1.0 public launch; absence blocks launch.
- **v1.0.x Fast-Follow** — Requirement committed post-launch on a defined timeline; does not block v1.0 launch.
- **Fair-Use Cap** — Soft monthly **Report** volume threshold on Pro tier beyond which ingest is throttled (not hard-deleted); documented in pricing copy.
- **GDPR Cascade** — Ordered deletion of all **Workspace**-scoped data across Postgres, R2, Redis job artifacts, and encrypted integration secrets.

---

## 4. Features

### 4.1 Capture SDK & Ingest

**Description:** Embeddable `@usebugreport/browser` SDK records a 2-minute circular Instant Replay buffer, console logs, network requests (with redaction), screenshot at submit, and environment metadata. Capture fires only on **Report** submit — no always-on server recording. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: SDK instant replay capture

Integrators can embed the SDK with a **Project** **Ingest Key** and receive 2-minute Instant Replay on submit.

**Consequences (testable):**
- Buffer length defaults to 120 seconds; configurable 30–120 seconds.
- Replay events upload to R2 via presigned URL or direct ingest endpoint; Postgres stores blob pointers only.
- Client-side gzip batching before upload; p95 ingest completion < 5s for typical 2-minute SPA payload on Pro tier.

#### FR-2: Console and network capture with privacy defaults

SDK captures console (`log/warn/error`) and fetch/XHR via rrweb plugins with redaction.

**Consequences (testable):**
- Password and credit-card input fields masked by default (`maskInputs`).
- Authorization headers and cookie values redacted in network capture.
- Network response/request bodies capped at 32 KB per request.
- SDK `ignoreRequestFn` excludes ingest endpoints to prevent feedback loops.

#### FR-3: Screenshot and metadata at submit

SDK attaches full-page or viewport screenshot (WebP) and environment metadata on submit.

**Consequences (testable):**
- Metadata includes URL, viewport, DPR, user agent, timestamp, optional integrator `setMetadata()` hook (userId, releaseId).
- Screenshot stored in R2 under `{orgId}/{projectId}/{reportId}/`.

#### FR-4: Ingest authentication and rate limits

Ingest endpoints accept only valid **Ingest Keys** scoped to a single **Project**; rate limits enforced per key and **Workspace** tier.

**Consequences (testable):**
- Invalid or revoked key returns HTTP 401.
- Free tier: max 30 **Reports**/calendar month per **Workspace** (hard cap).
- Pro tier: fair-use soft cap 2,000 **Reports**/calendar month per **Workspace**; beyond cap, ingest returns HTTP 429 with `Retry-After` and upgrade/contact message — existing **Reports** unaffected.
- Per-key ingest rate: max 10 submits/minute; burst 20; returns HTTP 429 when exceeded.
- Global ingest pipeline rate limit: 100 concurrent ingest jobs per **Workspace** (BullMQ back-pressure).

**Feature-specific NFRs:**
- Ingest path never writes raw blobs to VPS disk; async BullMQ worker persists to R2.

---

### 4.2 Report Storage, Viewer & Retention

**Description:** **Reports** persist as Postgres metadata + R2 blobs. Web app replay viewer uses rrweb-player. Retention enforced by R2 lifecycle rules per billing tier. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-5: Report metadata model

System stores **Report** title, status, reporter, environment JSON, blob pointers, derived summary JSONB, and full-text search vector.

**Consequences (testable):**
- Status enum: `open`, `in_progress`, `resolved`, `closed`, `duplicate`.
- Derived summary includes error counts, failed request list, user flow hints for agent consumption.
- Postgres FTS index on title + description + summary text for `search_reports`.

#### FR-6: Replay viewer in web app

Authenticated members with project access can view Instant Replay, screenshot, console, and network panels for a **Report**.

**Consequences (testable):**
- Replay loads from R2 via signed URL or proxied stream; player supports play/pause and timeline scrub.
- Console panel filterable by level; network panel filterable by status code and host.
- Viewer access denied returns HTTP 403 for insufficient project role.

#### FR-7: Tiered blob retention

R2 lifecycle rules delete blobs per **Workspace** billing tier.

**Consequences (testable):**
- Free: replay and screenshot retained 7 days; Postgres **Report** metadata retained 30 days then summary-only stub.
- Pro: replay retained 30 days; screenshot 90 days; metadata indefinite.
- Studio (post-v1 pricing tier): replay 90 days — configuration stub acceptable at v1 launch if Studio not sold yet.
- Lifecycle deletion logged; no orphan multipart uploads (>1 day abort rule).

---

### 4.3 Multi-Tenant Workspaces, Projects & RBAC

**Description:** **Workspaces** (organizations) and **Projects** with member invitations, project-level RBAC, and active-workspace session scoping. Realizes UJ-1, UJ-2, UJ-4.

**Functional Requirements:**

#### FR-8: Workspace and project CRUD

Owners and admins can create **Workspaces** and **Projects**, invite members, and manage **Ingest Keys**.

**Consequences (testable):**
- GitHub OAuth login via better-auth; session supports `setActive` organization.
- Multi-tenancy maps 1 user → N **Workspaces** via better-auth **Organization** plugin only — **no** better-auth Teams feature.
- **Mandatory first workspace:** After sign-in, a user with zero **Workspace** memberships is hard-redirected to `/onboarding` on any authenticated route (including `/settings/*`) until they belong to at least one **Workspace** via create or accepted invite. Middleware returns HTTP 302 to `/onboarding`; no **Workspace**-scoped routes render without membership.
- Free tier limited to 1 **Workspace**; Pro up to 5; higher tiers per pricing table (§9).
- Each **Project** generates rotatable **Ingest Key**; revocation immediate.

#### FR-9: Project-level RBAC

System enforces project roles: viewer, reporter, developer, admin.

**Consequences (testable):**
- Viewer: read **Reports** only.
- Reporter: read + submit via SDK.
- Developer: reporter + manage integrations + push to **Linear**.
- Admin: developer + delete **Reports** + manage project members.
- API key permissions respect same scope boundaries.

#### FR-10: GDPR cascading deletion

**Workspace** owners can request full **Workspace** deletion; system cascades across all data stores.

**Consequences (testable):**
- Deletion job removes: Postgres rows (organizations, projects, reports, comments, integrations, api keys, webhooks), R2 objects under `{orgId}/`, Redis keys, encrypted OAuth tokens.
- Job completes within 72 hours p95; owner receives email on completion.
- Audit log entry retained 90 days (legal minimum) with deletion event only — no **Report** content.
- Launch gate: must ship in v1.0.

---

### 4.4 Superuser Web App & Command Palette

**Description:** Dense report list, ⌘K command palette, keyboard shortcuts for triage, bulk operations, and **Workspace** switcher. Mantine UI; no Radix UI. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-11: Dense report list with keyboard navigation

Members can navigate, filter, and bulk-select **Reports** via keyboard.

**Consequences (testable):**
- List shows title, status, project, reporter, age, tracker link indicator.
- j/k or arrow navigation; x toggle select; Enter open detail.
- Filters: status, project, date range, full-text query (same index as API search).
- Bulk actions at launch: status change, push to **Linear**; assignee field + bulk assign deferred to v1.1 (FF-5).

#### FR-12: Command palette (⌘K)

Authenticated users invoke ⌘K (Ctrl+K on Windows/Linux) for actions.

**Consequences (testable):**
- Commands include: switch **Workspace**, open **Report** by ID/title, change status, push to **Linear**, copy agent summary, navigate to settings.
- Palette searchable with fuzzy match; recent commands remembered per user session.
- ≥ 50% of active Pro users invoke ⌘K or a registered shortcut weekly (success metric SM-3).

#### FR-13: Workspace switcher

Users with multiple **Workspace** memberships switch active **Workspace** in ≤ 2 keystrokes.

**Consequences (testable):**
- ⌘+1..9 switches to pinned **Workspaces**; ⌘K "Switch workspace" lists all.
- All queries and API keys scoped to active **Workspace** unless key specifies org explicitly.

#### FR-26: Report comments in web app

Authenticated project members with **reporter** role or above can view and create comments on a **Report** from the web app.

**Consequences (testable):**
- Comments tab on report detail shows thread ordered chronologically with author display name and timestamp.
- Composer (textarea + submit) creates comments via session auth; empty submit disabled; optimistic append with revert on failure.
- **Viewer** role sees thread read-only (no composer).
- Agent-created comments (FR-16, post-FF-1) render in the same thread attributed to API key name.
- Comment bodies stored in Postgres; included in **Workspace** deletion cascade (FR-10).

**Feature-specific NFRs:**
- First contentful paint on report list < 2s p95 on broadband.
- WCAG 2.1 AA for core triage flows (keyboard operable by default).

---

### 4.5 MCP Agent Surface

**Description:** Streamable HTTP MCP at `/mcp` exposing Jam-parity read tools plus `search_reports`; `create_comment` scoped as first-to-slip. All tools call **Shared Service Layer**. Free tier: MCP read-only. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-14: MCP authentication

MCP accepts **Workspace API Key** bearer tokens with scope metadata.

**Consequences (testable):**
- Free tier keys: scopes `reports:read`, `mcp:tools` (read tools only).
- Pro tier keys: add `reports:write` for comment/create operations when shipped.
- Invalid key returns MCP error; requests scoped to key's **Workspace** only.

#### FR-15: MCP read tool suite (launch gate)

MCP exposes read tools mirroring REST:

| Tool | Purpose |
|------|---------|
| `list_reports` | Paginated **Reports** with filters (status, project, since, cursor) |
| `get_report` | Full **Report** metadata |
| `get_report_summary` | Token-efficient summary for LLMs |
| `get_console_logs` | Filtered by level, limit |
| `get_network_requests` | Filtered by status, host, limit |
| `search_reports` | Postgres FTS query across **Workspace** **Reports** |

**Consequences (testable):**
- Tool p95 latency < 2s for `get_report_summary` on Pro tier.
- `search_reports` accepts `query` string + optional filters; returns ranked IDs + snippets.
- Tool parameter schemas documented; identical outcomes to REST equivalents.

#### FR-16: Agent create_comment — MCP + REST (first-to-slip, not launch gate)

MCP exposes `create_comment`; REST exposes `POST /api/v1/reports/:id/comments` — both invoke the same **Shared Service Layer** method as human web comments (FR-26), scoped to **Workspace API Key** auth.

**Consequences (testable):**
- Ships within 2 weeks post-launch OR blocks v1.1 release — not a v1.0 launch gate. Human web comment creation (FR-26) ships at v1.0 launch.
- MCP tool and REST endpoint return field-equivalent comment payloads (modulo transport envelope).
- Creates comment thread entry attributed to API key name; visible in web app alongside human comments.
- Idempotent via optional client-supplied dedupe key.

---

### 4.6 REST API & MCP Parity

**Description:** REST at `/api/v1` with OpenAPI 3.1; every MCP read tool has REST equivalent via **Shared Service Layer**. Realizes UJ-3.

**Functional Requirements:**

#### FR-17: REST report endpoints (launch gate)

REST exposes:

- `GET /reports` — list with cursor pagination
- `GET /reports/:id` — full metadata
- `GET /reports/:id/summary` — token-efficient summary
- `GET /reports/:id/console-logs`
- `GET /reports/:id/network-requests`
- `GET /reports/search` — FTS query param `q`

**Consequences (testable):**
- Responses match MCP tool outputs field-for-field (modulo transport envelope).
- OpenAPI spec published at `/openapi.json`; Bearer auth documented.
- Breaking changes require version bump policy (see §10).

#### FR-18: Shared service layer enforcement

MCP handlers and REST handlers invoke the same domain services — no duplicated business logic.

**Consequences (testable):**
- Code review gate: no MCP tool implements query logic inline.
- Integration tests assert MCP/REST parity for each read operation.

#### FR-19: Outbound webhooks

**Workspaces** on Pro+ can register webhook endpoints for events.

**Consequences (testable):**
- Launch events: `report.created`, `report.updated`.
- `report.comment.created` ships v1.1 with FF-4 (after `create_comment` lands).
- HMAC-SHA256 signature header `X-UseBugReport-Signature`; exponential backoff delivery (5 attempts).
- Delivery log visible in settings debug UI.

---

### 4.7 Linear Integration (v1 Launch)

**Description:** Outbound push from **Report** to **Linear** issue create — sole tracker integration at v1.0 launch. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-20: Linear OAuth and configuration

**Workspace** admins connect Linear via OAuth; select default team per **Project** or **Workspace**.

**Consequences (testable):**
- Tokens stored encrypted; refresh handled automatically.
- Integration profile per **Workspace** (supports freelancer multi-client model).
- Disconnect revokes tokens and disables push.

#### FR-21: Push Report to Linear

Users trigger push via web app or ⌘K; system creates Linear issue with title, description, link back to **Report**, and console excerpt.

**Consequences (testable):**
- Linear issue URL stored on **Report**; idempotent push returns existing link.
- Push succeeds on first attempt ≥ 95% when integration configured (SM-4).
- Failed push surfaces actionable error (auth, rate limit, validation).

**Out of Scope (v1.0):**
- Inbound Linear status sync → v1.1 fast-follow (FR-24).
- GitHub Issues → v1.1 committed (not v1.0).

---

### 4.8 API Keys & Agent Auth

**Description:** **Workspace API Keys** for agents; **Ingest Keys** for SDK. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-22: Workspace API key management

Admins create, rotate, and revoke **Workspace API Keys** with scope checkboxes.

**Consequences (testable):**
- Prefix `ubr_live_`; stored hashed; shown once on create.
- Scopes: `reports:read`, `reports:write`, `mcp:tools`, `webhooks:manage`.
- Keys inherit **Workspace** tier limits (Free read-only MCP).

#### FR-23: Session and bearer auth for automation

better-auth bearer plugin supports non-cookie clients for CI and agents.

**Consequences (testable):**
- API key last-used timestamp updated on each request.
- Expired or revoked keys rejected with HTTP 401.

---

### 4.9 v1.1 Fast-Follow Integrations (Not Launch Gate)

**Description:** Committed post-launch capabilities with defined order.

**Functional Requirements:**

#### FR-24: Linear inbound status sync (v1.1)

Linear webhooks update **Report** status when linked issue changes.

**Consequences (testable):**
- Webhook signature verified via `@linear/sdk/webhooks`.
- Status mapping configurable per **Workspace**.

#### FR-25: GitHub Issues outbound (v1.1)

Push **Report** to GitHub Issues via GitHub App OAuth.

**Consequences (testable):**
- Issue body includes **Report** link and summary.
- Committed to v1.1 — not optional fast-follow.

---

## 5. Non-Goals (Explicit)

- Always-on session replay for all visitors.
- Chrome MV3 browser extension (v2.0).
- Tokenized recording links for external reporters (v2.0 — requires abuse/consent spike first).
- Screen video capture (v2.5 extension-only).
- AI auto-fix / PR generation.
- Support suite: live chat, NPS, customer portals.
- Mobile native SDKs.
- Self-serve SSO/SCIM.
- White-label and client portals (Agency tier later).
- Cross-workspace `summarize_workspace` or unified inbox (deferred backlog).
- Source map upload / stack unminify (v1.5).
- Screenshot annotation (v1.5).
- Jira integration (post-v1.1 roadmap).

---

## 6. MVP Scope

### 6.1 v1.0 Launch Gate Checklist

All items below **must** ship before public v1.0 launch:

| # | Launch Gate | FRs |
|---|-------------|-----|
| LG-1 | `@usebugreport/browser` SDK ingest (Instant Replay, console, network, screenshot, metadata) | FR-1–FR-4 |
| LG-2 | Replay viewer + report detail + comments in web app | FR-5, FR-6, FR-26 |
| LG-3 | **Workspace** / **Project** CRUD + project RBAC | FR-8, FR-9 |
| LG-4 | Linear outbound push (create issue) | FR-20, FR-21 |
| LG-5 | MCP read suite including `search_reports` | FR-14, FR-15 |
| LG-6 | REST parity via **Shared Service Layer** | FR-17, FR-18 |
| LG-7 | GDPR cascading deletion | FR-10 |
| LG-8 | Fair-use rate limits + tier quotas (Free 30/mo; Pro fair-use) | FR-4 |
| LG-9 | Superuser triage: dense list, ⌘K, keyboard nav, workspace switcher | FR-11–FR-13 |
| LG-10 | Outbound webhooks (`report.created`, `report.updated`) | FR-19 |
| LG-11 | Tiered R2 retention enforcement | FR-7 |

### 6.2 v1.0.x Fast-Follow (Post-Launch, Ordered)

| Priority | Item | Timeline | FRs | Notes |
|----------|------|----------|-----|-------|
| FF-1 | `create_comment` MCP + REST | ≤ 2 weeks post-launch | FR-16 | **First to slip**; blocks v1.1 if missed |
| FF-2 | Linear inbound status sync | v1.1 | FR-24 | |
| FF-3 | GitHub Issues outbound | v1.1 | FR-25 | Council committed — not "if schedule allows" |
| FF-4 | `report.comment.created` webhook | v1.1 | FR-19 | |
| FF-5 | Assignee field + bulk assign | v1.1 | FR-11 | |

### 6.3 Council Reconciliation (Brief Drift)

| Topic | Brief / Addendum | Council Settlement (PRD) |
|-------|------------------|--------------------------|
| Free tier cap | 25 reports/mo | **30 reports/mo**, 1 **Workspace**, MCP read-only |
| v1 integrations | Linear + GitHub fast-follow | **Linear outbound only** at launch; GitHub **v1.1 committed** |
| `search_reports` | Implied in MCP suite | **Explicit v1 launch gate** (Postgres FTS) |
| Recording links | v1.5 in brief | **v2.0** with Chrome extension; abuse/consent spike prerequisite |
| Human report comments | Brief pillar-4 "report detail + comments" | **Launch gate** (FR-26 web app composer) |
| Agent `create_comment` | Optional v1 | **Not launch gate** (FR-16 MCP+REST); slip ≤2 weeks blocks v1.1 |
| `summarize_workspace` | Persona copy references | **Deferred backlog** — out of v1 |
| Pro unlimited reports | Marketing "unlimited" | **Fair-use soft cap** 2,000/mo with aligned marketing copy (§9) |
| Agent API metric | ≥1 call per report | Counts **READ tools** at launch |

### 6.4 Out of Scope Table

| Item | Target Phase | Rationale |
|------|--------------|-----------|
| Chrome extension | v2.0 | MV3 complexity; SDK covers owned apps |
| Recording links | v2.0 | Abuse/consent spike required first |
| Screen video | v2.5 | Storage cost; extension-only |
| GitHub Issues | v1.1 | Council sequencing — not v1.0 |
| Linear inbound sync | v1.1 | Outbound-first wedge |
| Jira | v1.2+ | Multi-tracker expansion |
| SSO/SCIM | Enterprise later | Sales-assisted |
| White-label portals | Agency tier | Scope creep |
| `summarize_workspace` | Backlog | Cross-workspace analytics deferred |
| Source maps | v1.5 | releaseId discipline needed |
| Annotation | v1.5 | Nice-to-have |

---

## 7. Success Metrics

**Primary**

- **SM-1:** Median time from bug observed to **Report** submitted with replay **< 30 seconds** for SDK-embedded apps. Validates FR-1, FR-3.
- **SM-2:** **≥ 1 agent API call per human-created Report** among MCP-enabled **Workspaces** — **READ tools count** (`list_reports`, `get_report_summary`, `search_reports`, etc.). Validates FR-14, FR-15.
- **SM-3:** **≥ 50%** of active Pro users invoke ⌘K or a registered keyboard shortcut during triage weekly. Validates FR-11, FR-12.
- **SM-4:** Linear push succeeds on first attempt **≥ 95%** when integration configured. Validates FR-21.

**Secondary**

- **SM-5:** Ingest p95 **< 5s** for 2-minute replay payloads on Pro tier. Validates FR-1, FR-4.
- **SM-6:** MCP `get_report_summary` p95 **< 2s**. Validates FR-15.
- **SM-7:** **100 paying Workspaces** within 6 months; **≥ 40%** on multi-**Workspace** plans. Validates FR-8.
- **SM-8:** **≤ 5%** monthly churn on paid tiers.

**Business / GTM**

- **SM-9:** Agent docs/tutorial cited in **≥ 3** community posts or integrations within 6 months.

**Counter-metrics (do not optimize)**

- **SM-C1:** Raw **Report** volume on Pro — do not optimize beyond fair-use health; prevents storage margin collapse.
- **SM-C2:** MCP tool call volume alone — quality over quantity; do not incentivize empty polling loops.
- **SM-C3:** Zero unresolved PII incidents in replay storage — any incident triggers freeze on new ingest until remediated.

---

## 8. Cross-Cutting Non-Functional Requirements

### 8.1 Performance

- Report list API p95 < 500ms for 50 items.
- Ingest pipeline: async via BullMQ; API ack after enqueue < 200ms p95.
- R2 multipart upload for payloads > 5 MB.

### 8.2 Security

- TLS everywhere; R2 encryption at rest.
- OAuth tokens and API secrets encrypted at application layer.
- CSP and input sanitization on web app.
- MCP pinned to `@modelcontextprotocol/server` v1.x until v2 GA evaluated.

### 8.3 Reliability

- Single VPS acceptable for v1; Coolify health checks.
- Postgres daily backup; R2 versioning optional.
- Webhook delivery at-least-once with idempotent consumer guidance.

### 8.4 Observability

- Structured logs with `reportId`, `workspaceId`, `traceId`.
- Metrics: ingest duration, MCP tool latency, Linear push success rate, deletion job duration.
- Alert on ingest error rate > 1% over 5 minutes.

---

## 9. Monetization

Four pricing tiers are defined below. **Free** is the try-out base tier. **Only Free and Pro are v1.0 launch tiers (sellable).** Studio and Agency are documented placeholders — **defined, not sellable at v1.0** — and add no launch scope. Self-serve billing/payment checkout is out of v1.0 scope; v1 enforces tier quotas and retention only.

| Tier | Price | v1.0 availability | Reports/mo (per **Workspace**) | **Workspaces** | MCP / REST | Replay retention | Other limits |
|------|-------|-------------------|-------------------------------|----------------|------------|------------------|--------------|
| **Free** | $0 | **Launch tier (sellable)** | **30** (hard cap) | **1** | MCP read-only | **7 days** | 1 integration |
| **Pro** | $12/mo | **Launch tier (sellable)** | **2,000** fair-use soft cap | up to **5** | Full MCP + REST | **30 days** | Webhooks, keyboard power features |
| **Studio** | $29/mo | **Defined, not sellable at v1.0** | Fair-use high volume (TBD at GA) | Unlimited | Full MCP + REST | **90 days** (per FR-7) | Unlimited members; bi-directional sync when shipped |
| **Agency** | $79/mo | **Defined, not sellable at v1.0** | Custom / high volume (TBD at GA) | Unlimited multi-client | Full MCP + REST | **90 days** (minimum at GA) | White-label, client portals, cross-**Workspace** queue (post-v1); SSO (future) |

**Fair-use alignment:** Pro marketing copy states "Reports included for normal product-team use" — not "unlimited" without qualification. Fair-use cap triggers throttling (HTTP 429 on ingest), not data deletion. Sales contact path for sustained high volume.

Unlimited seats on paid tiers (no per-seat tax).

---

## 10. API Contracts & Versioning

- REST version prefix: `/api/v1`.
- OpenAPI 3.1 at `/openapi.json`.
- Breaking changes require `/api/v2`; v1 supported ≥ 6 months after v2 GA.
- MCP tool names stable; additive parameters allowed.
- Deprecation communicated via `Sunset` header and changelog 90 days ahead.

---

## 11. Data Governance

- Capture-on-**Report**-only; no always-on recording.
- EU data: DPA template available at launch; **GDPR Cascade** (FR-10) mandatory.
- Retention per §FR-7; customers can configure shorter retention within tier max.
- PII minimization: default masks, header redaction, integrator blocklist selectors in SDK.
- Data residency: single region (EU-friendly hosting narrative; full region choice post-v1).

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PII in replays | Legal, trust | FR-2 masks; blocklist; retention; SM-C3 |
| Ingest payload blow-up | Cost, UX | 32 KB body cap; gzip; fair-use caps |
| Scope creep | Launch slip | Launch gate checklist; §6.4 out-of-scope |
| Jam adds history search | Competitive | Ship `search_reports` at launch; keyboard UX |
| MCP spec churn | Breakage | Pin v1.x; abstract transport |
| Single VPS SPOF | Downtime | Backups; acceptable early SaaS |
| Fair-use backlash | Conversion | Transparent copy; grace warnings at 80% cap |

---

## 13. Epics-Level Scope Boundaries

Epics derive from feature groups; each epic inherits launch gate vs fast-follow label.

| Epic | Scope | Gate |
|------|-------|------|
| E1 Capture SDK | FR-1–FR-4 | Launch |
| E2 Ingest Pipeline & Storage | FR-4, FR-5, FR-7 | Launch |
| E3 Web App Core | FR-6, FR-8, FR-11–FR-13, FR-26 | Launch |
| E4 Auth & RBAC | FR-8, FR-9, FR-22, FR-23 | Launch |
| E5 MCP Server | FR-14, FR-15 | Launch |
| E6 REST API | FR-17, FR-18 | Launch |
| E7 Linear Outbound | FR-20, FR-21 | Launch |
| E8 Webhooks | FR-19 | Launch |
| E9 GDPR Deletion | FR-10 | Launch |
| E10 Agent Write (`create_comment`) | FR-16 | Fast-follow FF-1 |
| E11 Linear Inbound + GitHub | FR-24, FR-25 | v1.1 |

---

## 14. Open Questions

1. **Assignee model:** Deferred to v1.1 (FF-5). Recommend free-text assignee first; user-ID linking in a later fast-follow.
2. **Studio tier GA:** Defined in §9; not sellable at v1.0 — GA when bi-directional sync ships. Agency tier likewise defined, not sellable at v1.0.
3. **EU hosting region:** Single VPS location vs CF Workers edge for API — architecture doc decision.

---

## 15. Assumptions Index

- **A-1:** GitHub OAuth sufficient for v1 human login (no email/password).
- **A-2:** Linear is primary tracker for ICP; GitHub v1.1 satisfies secondary.
- **A-3:** 2,000 Reports/mo fair-use cap adequate for Pro margin on 12 GB VPS + R2.
- **A-4:** Postgres FTS sufficient for v1 search; semantic/vector search deferred.
- **A-5:** Single Contabo VPS viable through first 100 paying **Workspaces**.
- **A-6:** better-auth organization + apiKey plugins cover auth without custom IdP.
