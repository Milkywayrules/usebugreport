---
title: usebugreport Product Brief
status: draft
created: 2026-07-20
updated: 2026-07-20
---

# Product Brief: usebugreport

## Executive Summary

**usebugreport** is a bug-reporting and session-capture platform built by Verasic Labs for builders who work with both humans and AI agents. The category is crowded—Jam, Marker.io, BetterBugs, and others converge on screenshots, console logs, and issue-tracker push—but differentiation in 2026 is shifting to **agent connectivity**, **workflow depth for multi-client work**, and **power-user UX**, not raw capture mechanics.

Our wedge: **the bug-reporting OS for AI-augmented builders** — humans file rich reports in seconds; agents read, search, summarize, and act autonomously via MCP and REST with identical capability. A keyboard-first web app (Linear-grade density) serves the same users who already triage in Cursor, Claude Code, or Telegram Hermes bots.

v1 ships the smallest vertical slice that honors all five founder pillars: embeddable rrweb SDK capture (2-minute instant replay, console + network), dense triage UI, workspace-per-client multi-tenancy, outbound integrations (Linear first), and a Jam-parity MCP server on day one. Chrome extension, video capture, AI auto-fix, and support-suite features are explicitly deferred.

## The Problem

Bug reporting tools capture context well but fail the people who file *and* fix bugs daily:

1. **Context-switch tax.** Power users (devs, QA leads, solo founders) click through extension widgets and mouse-heavy forms while their real workflow lives in keyboard-driven tools. Filing a bug feels slower than describing it in Slack.

2. **Agent blind spots.** MCP is becoming table stakes (Jam, Marker.io, BugHerd ship it), but tools skew read-only triage on single reports. Agents cannot search history, detect duplicates across releases, or sync write-back to a client's Linear org without brittle custom glue.

3. **Multi-client chaos.** Freelancers and agencies juggle 3–10 clients, each with different trackers, staging URLs, and reviewers. Per-seat pricing punishes rotating client stakeholders; cross-workspace visibility ("what's open across all clients?") barely exists.

4. **Integration asymmetry.** Most tools push reports outbound to Jira or Linear but do not pull status back. Freelancers maintaining separate tracker credentials per client have no "integration profile per workspace" as a first-class concept.

The cost: bugs get under-reported, tickets lack repro context, agents re-ask questions humans already captured, and agencies burn hours on seat math and manual sync.

## The Solution

usebugreport is a **capture + triage hub** where human UI and agent API are co-equal surfaces:

- **Capture:** An embeddable `@usebugreport/browser` SDK records a 2-minute DOM replay buffer (rrweb), console logs, network requests (with redaction), screenshot, and environment metadata—triggered only when the user submits a report (privacy-friendly, no always-on recording).

- **Triage:** A dense web app with command palette (⌘K), keyboard navigation, bulk status changes, and fast workspace switching serves the same person who files the bug.

- **Agent access:** Streamable HTTP MCP at `/mcp` and REST at `/api/v1` expose the same operations—list, search, get summary, get console/network/replay context, create comments—with workspace-scoped API keys for headless agents (Claude CLI, Cursor, Telegram Hermes).

- **Multi-tenancy:** Organizations map to workspaces (client or product boundary); projects hold ingest keys and integration configs; members and API keys are scoped per org.

- **Integrations:** Outbound push to Linear (v1 priority), GitHub Issues, and Jira; webhooks for automation; inbound status sync from Linear as fast-follow.

## What Makes This Different

| Differentiator | Why it matters |
|----------------|----------------|
| **MCP + REST parity** | Same capability matrix for agents and integrations—not MCP as a checkbox with REST gated to enterprise tiers. |
| **History-aware agent tools** | `search_reports`, token-efficient summaries, workspace-scoped list/filter—beyond single-report triage. |
| **Linear-grade keyboard UX** | Unoccupied whitespace in the capture category; appeals to devs and QA who already live in superuser tools. |
| **Workspace-native architecture** | Built for freelancers/agencies from v1—not projects bolted on after the fact. |
| **Privacy-default capture** | Opt-in, on-report-only replay; configurable retention; input masking—credible for EU/regulated buyers without always-on session recording. |

Honest moat: **execution at the intersection** of agent-native API depth, keyboard triage, and multi-workspace workflows—not a novel capture engine (rrweb is commodity). Speed to ship and integration depth matter more than invented technology.

## Who This Serves

**Primary segments (v1):**

| Segment | Need | Success looks like |
|---------|------|-------------------|
| **Freelancers & solo consultants** | One login, many client workspaces; minimal monthly burn; agent summarizes "what's open across clients" | Switch workspace in one keystroke; file bug without leaving keyboard; Hermes bot fetches latest reports |
| **Web agencies & dev shops (3–30 people)** | Per-client isolation; push to client's tracker; no seat-tax on rotating reviewers | Each client workspace has its own integration profile; agency queue shows today's reports across clients |
| **QA & product teams (in-house)** | Rich repro context; bulk triage at speed; compliance-friendly retention | "Can't reproduce" drops; ⌘K assign/push to Linear; 30-day replay retention on Pro |
| **AI-augmented solo devs & indie hackers** | MCP/REST for Cursor and Claude Code; low setup friction | `list_reports` + `get_report_summary` works in first agent session; free tier includes MCP read |

**Secondary (phase 2+):** Jira/Atlassian shops migrating off Issue Collector; enterprise SSO buyers.

## Success Criteria

**User success (90 days post-launch):**

- Median time from "bug observed" to "report submitted with replay" **< 30 seconds** for SDK-embedded apps.
- **≥ 50%** of active Pro users invoke ⌘K or a keyboard shortcut during triage weekly.
- **≥ 1 agent API call per human-created report** among MCP-enabled workspaces (agents are actually in the loop).
- Linear push succeeds on first attempt **≥ 95%** when integration is configured.

**Business success (6 months):**

- **100 paying workspaces** (Pro or Studio) with **≥ 40%** on multi-workspace plans (validates agency/freelancer wedge).
- **≤ 5%** monthly churn on paid tiers.
- Agent docs/tutorial cited in **≥ 3** community posts or integrations (organic GTM signal).

**Technical health:**

- Ingest p95 **< 5s** for 2-minute replay payloads on Pro tier.
- MCP tool latency p95 **< 2s** for `get_report_summary`.
- Zero unresolved PII incidents in replay storage.

## Scope

### v1 — in (smallest slice honoring all five pillars)

| Pillar | v1 deliverable |
|--------|----------------|
| (1) Superuser UX | Dense report list; ⌘K command palette; keyboard shortcuts for status, assign, push-to-tracker; workspace switcher |
| (2) API integrations | REST `/api/v1` + OpenAPI; outbound webhooks (`report.created`, `report.updated`); Linear outbound create issue |
| (3) AI-agent-native | MCP `/mcp` with Jam-parity tools: `list_reports`, `get_report`, `get_report_summary`, `get_console_logs`, `get_network_requests`; workspace API keys (`ubr_live_`) |
| (4) Human web app | GitHub OAuth login; org/project CRUD; rrweb replay viewer; screenshot + metadata panel; report detail + comments |
| (5) Multi-tenant | better-auth organizations; projects with ingest keys; project-level RBAC (viewer/reporter/developer/admin); per-workspace integration config |

**Capture (v1):** `@usebugreport/browser` SDK — rrweb 2-min circular buffer, console + network plugins, screenshot at submit, privacy masks (password fields, auth header redaction), custom metadata hook.

**Backend:** Bun monorepo; ElysiaJS (REST + MCP); Postgres + Drizzle metadata; R2 blobs; Redis + BullMQ ingest pipeline; Docker/Coolify on 12 GB Contabo VPS.

**Integrations (v1):** Linear outbound (create issue from report). GitHub Issues outbound and Linear inbound status sync are v1 fast-follow if schedule allows—not launch blockers.

### Explicitly out (deferred)

| Deferred | Rationale | Target phase |
|----------|-----------|--------------|
| Chrome MV3 extension | 4–6 weeks MV3 complexity; SDK covers owned/UAT sites first | v2.0 |
| Screen video recording | Heavy storage; not differentiation for wedge | v2.5 (extension-only) |
| AI auto-fix / PR generation | Gleap/Replay territory; high scope | Not v1 roadmap |
| Always-on session replay | Privacy/cost; observability capital intensity | Never as default |
| Support suite (live chat, NPS, portals) | Gleap/Usersnap path; scope creep | Not planned v1 |
| Mobile native SDK | Gleap/Instabug dominate; web-first wedge | v2+ |
| Annotation on screenshots | Nice-to-have; screenshot + replay sufficient | v1.5 |
| Recording links (tokenized capture URL) | Valuable but not required for pillar proof | v1.5 |
| Self-serve SSO/SCIM | Enterprise sales motion; not early SaaS | Enterprise tier later |
| Source map upload / unminify | v1.5; strict releaseId discipline needed | v1.5 |
| Bi-directional sync (all trackers) | Outbound first; inbound Linear webhook fast-follow | v1.1 |
| White-label / client portals | Agency tier feature | Studio/Agency phase |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **PII in replays** (passwords, health data, tokens in DOM/network) | Legal, trust, churn | Default input masking; network header/body redaction; blocklist selectors; consent banner config in SDK; R2 encryption at rest; retention tiers |
| **Ingest payload blow-up** on heavy SPAs | VPS/R2 cost, slow uploads, bad UX | Client-side batch gzip; 32 KB network body cap; 2-min buffer only; BullMQ async pipeline; never store blobs on VPS disk |
| **Scope creep** (extension, video, AI fix, support features) | Miss launch; 5-person studio overload | This brief is the boundary document; defer list is non-negotiable for v1 |
| Jam adds deep agent history | Competitive pressure | Move fast on search/summarize MCP; differentiate keyboard UX + multi-workspace |
| MCP spec churn (v2 beta) | Integration breakage | Pin `@modelcontextprotocol/server` v1.x; abstract transport layer |
| Single 12 GB VPS SPOF | Downtime | Coolify health checks; Postgres + R2 backups; acceptable for early SaaS |

## Constraints

- **Stack (fixed):** Bun + turborepo; Next.js + Mantine (never Radix UI); ElysiaJS; better-auth (organization + apiKey plugins); Postgres + Drizzle; Redis + BullMQ; Cloudflare R2; Docker/Coolify on Contabo VPS.
- **Team capacity:** Verasic Labs — 5-person studio; v1 built solo-to-small-team; no parallel workstreams for extension + SDK + enterprise features.
- **Infrastructure:** 12 GB VPS viable for compute and hot metadata; all replay blobs on R2 with lifecycle rules (7-day free, 30-day Pro); aggressive defaults to protect margins.
- **Privacy posture:** Capture-on-report only; no always-on recording; GDPR-ready retention and DPA template before EU push.

## Vision

If v1 succeeds, usebugreport becomes the **default bug layer for AI-augmented development teams**—the place where human reports and agent context meet before anything hits Linear or Jira. Year two adds Chrome extension parity, recording links for external reporters, bi-directional sync across trackers, and cross-workspace analytics for agencies. Long term: the product stays lightweight (capture + triage + agent API) rather than expanding into Gleap-style support suites or LaunchDarkly-style observability—partners fill the debugging loop; we own the report → agent → tracker handoff.
