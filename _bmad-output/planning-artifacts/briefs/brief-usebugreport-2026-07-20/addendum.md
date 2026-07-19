# usebugreport Product Brief — Addendum

Supplementary detail for downstream PRD and architecture work. Not duplicated in `brief.md`.

## Pricing Hypothesis (validation required)

| Plan | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 1 workspace, 25 reports/mo, MCP read, 1 integration, 7-day replay retention |
| **Pro** | $12/mo | Unlimited reports, 5 workspaces, full MCP + API, keyboard power features, 30-day retention |
| **Studio** | $29/mo | Unlimited workspaces/members, bi-directional sync, webhooks, 90-day retention |
| **Agency** | $79/mo | White-label, client portals, cross-workspace analytics, SSO (future) |

Rationale: undercut Jam per-creator ($14) and Marker starter ($39); unlimited seats on paid tiers reduce agency friction; issue-volume cap on free controls abuse (IssueCapture pattern).

## Persona Snapshots

### "Maya" — Freelance full-stack dev

- 6 active clients, each with own Linear workspace or GitHub repo
- Uses Cursor + Claude Code daily; Telegram Hermes for mobile alerts
- Pain: re-entering tracker credentials; no unified "today's bugs" view
- Wins when: ⌘+1..9 workspace switch; agent runs `summarize_workspace` each morning

### "Agency Apex" — 12-person dev shop

- 20 concurrent client sites on staging; mixed technical/non-technical reporters
- Pain: BugHerd seat tax when client PMs rotate; no cross-client duplicate detection
- Wins when: per-client workspace with isolated integration; agency queue across workspaces

### "In-house QA lead" — 40-person product org

- Single product, staging + prod; SOC 2 pressure on retention
- Pain: bulk triage in mouse-heavy tools; agents can't read report history
- Wins when: vim-style list navigation; MCP `search_reports` for regression patterns

## v1 Implementation Sequence (from technical research)

| Sprint | Focus | Exit criteria |
|--------|-------|---------------|
| S1 | Capture SDK + ingest API | 2-min replay uploads to R2; report row in Postgres |
| S2 | Web app viewer + org auth | GitHub login, create org/project, view replay |
| S3 | MCP + API keys | Agent can `get_console_logs` + `get_report_summary` with PAT |
| S4 | Webhooks + Linear | Report → Linear issue; status webhook back (if in v1.1) |
| S5 | Polish + retention | R2 lifecycle, rate limits, privacy masks |

## MCP Tool Surface (v1 target — Jam parity)

- `list_reports` — workspace scope, filters, pagination
- `get_report` — full metadata
- `get_report_summary` — token-efficient markdown/JSON for LLMs
- `get_console_logs` — filtered by level, limit
- `get_network_requests` — filtered by status, host, limit
- `create_comment` — agent write path (optional v1)

## API Key Model

| Key type | Prefix | Scope | Use case |
|----------|--------|-------|----------|
| Workspace API key | `ubr_live_` | Organization + permissions | CI agents, Telegram Hermes, MCP |
| Project ingest key | `ubr_ingest_` | Single project, write-only | SDK snippet (browser-public; rate-limited) |

## Go-to-Market Motions (post-v1)

1. **Agent builders:** MCP server registry listing; docs for Cursor, Claude Code, Telegram bot
2. **Jira refugees:** Migration guide from Issue Collector; multi-tracker vs IssueCapture
3. **Indie/agency social:** Keyboard demo GIFs; workspace-switching workflow; flat pricing story

## Rejected Alternatives

| Alternative | Why rejected for v1 |
|-------------|---------------------|
| Browser extension first | MV3 adds 4–6 weeks; SDK proves capture on owned apps |
| Self-host / open-source core | Crikket pressure real; consider OSS SDK later with hosted sync monetization—not v1 |
| AI auto-title/repro as headline | Table stakes; not wedge; ship basic title from URL/error if trivial |
| Full observability platform | Highlight→LaunchDarkly lesson; stay capture/triage |

## Open Questions (for PRD)

- Free tier report cap: 25 vs 30 (Jam alignment)?
- Linear-only v1 integration vs Linear + GitHub Issues both at launch?
- Recording links in v1.5 vs v2—depends on agency inbound demand signal
