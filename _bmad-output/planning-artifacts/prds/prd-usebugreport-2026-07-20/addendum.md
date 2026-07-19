# usebugreport PRD — Addendum

Technical and overflow detail for architecture, UX spec, and solution design. Not duplicated in `prd.md`.

## Stack (Fixed — Do Not Relitigate)

- **Runtime:** Bun; turborepo monorepo
- **Frontend:** Next.js + Mantine UI (never Radix UI; use base-ui if headless primitive needed)
- **Data fetching:** TanStack Query; TanStack Table for dense lists
- **Backend:** ElysiaJS — REST `/api/v1` + MCP `/mcp` via shared service layer
- **Auth:** better-auth (organization + apiKey + bearer plugins)
- **Database:** PostgreSQL + Drizzle ORM
- **Queue:** Redis + BullMQ
- **Blob storage:** Cloudflare R2
- **Deploy:** Docker/Coolify on 12 GB Contabo VPS
- **Tests:** bun test (unit); Playwright (e2e)

## Capture Package Layout

```
packages/
  capture-core/     # rrweb record, plugins, buffer, privacy masks
  capture-sdk/      # @usebugreport/browser — embeddable snippet
  capture-extension/  # stub — v2.0
```

## SDK Init Shape (Conceptual)

```typescript
useBugReport.init({
  projectKey: 'ubr_ingest_...',
  bufferSeconds: 120,
  captureConsole: true,
  captureNetwork: true,
  networkBodyMaxBytes: 32_768,
  maskInputs: ['password', 'credit-card'],
  metadata: () => ({ userId, releaseId }),
});
```

## Backend Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ElysiaJS App                          │
├─────────────────────────────────────────────────────────┤
│  /api/v1/*          REST (OpenAPI via @elysiajs/swagger) │
│  /mcp               Streamable HTTP MCP                   │
│  /api/auth/*        better-auth handler                   │
├─────────────────────────────────────────────────────────┤
│              Domain services (shared)                     │
│  ReportService │ CaptureIngestService │ SummaryService    │
│  IntegrationService │ DeletionService │ SearchService     │
├─────────────────────────────────────────────────────────┤
│  Postgres (Drizzle) │ Redis │ R2 (S3 API)                │
└─────────────────────────────────────────────────────────┘
```

MCP tools are thin wrappers calling the same service methods as REST handlers.

## R2 Key Conventions

```
{bucket}/
  {orgId}/{projectId}/{reportId}/
    replay/batch-{seq}.json.gz
    screenshot.webp
    meta.json
  maps/{releaseId}/{file}.map   # v1.5
```

## Drizzle Schema (Core Entities)

```
organizations ─┬─ projects ─┬─ reports ─┬─ report_blobs (r2_key, type, size, seq)
               │            │           └─ report_summary (derived, JSONB)
               │            │           └─ report_search_vector (tsvector)
               ├─ members (role)
               └─ api_keys (hash, scopes, org_id)

project_members (project_id, user_id, role)
integrations (type, oauth_tokens_encrypted, config JSONB)
webhook_endpoints (url, secret, events[])
webhook_deliveries (status, payload, attempts)
deletion_jobs (workspace_id, status, started_at, completed_at)
```

## Ingest Pipeline

1. SDK POSTs to `/api/v1/capture/ingest` (presigned URL for large payloads)
2. Elysia validates **Ingest Key** → enqueues BullMQ job
3. Worker compresses (if not client-gzipped), writes R2 multipart for >5 MB
4. Updates Postgres **Report** row with blob pointers + derived summary + FTS vector

## MCP Tool ↔ REST Mapping

| MCP Tool | REST Endpoint |
|----------|---------------|
| `list_reports` | `GET /api/v1/reports` |
| `get_report` | `GET /api/v1/reports/:id` |
| `get_report_summary` | `GET /api/v1/reports/:id/summary` |
| `get_console_logs` | `GET /api/v1/reports/:id/console-logs` |
| `get_network_requests` | `GET /api/v1/reports/:id/network-requests` |
| `search_reports` | `GET /api/v1/reports/search?q=` |
| `create_comment` | `POST /api/v1/reports/:id/comments` |

## Summary Endpoint Shape (Agent Token Budget)

```json
{
  "id": "rpt_abc",
  "title": "Checkout button unresponsive",
  "status": "open",
  "reporter": { "email": "qa@client.com" },
  "environment": { "browser": "Chrome 138", "os": "macOS", "url": "..." },
  "errorSummary": "TypeError: Cannot read properties of null (×3)",
  "failedRequests": [{ "method": "POST", "url": "/api/checkout", "status": 500 }],
  "userFlow": ["Navigated to /cart", "Clicked #checkout"],
  "replayAvailable": true,
  "replayDurationMs": 87000
}
```

## Linear Push Mutation (Conceptual)

```graphql
mutation {
  issueCreate(input: {
    teamId: "..."
    title: "[UBR] Checkout failure"
    description: "## Report\nhttps://app.usebugreport.com/r/abc\n\n## Console\n```\nTypeError...\n```"
  }) { issue { id url } }
}
```

## Webhook Delivery

- HMAC-SHA256 `X-UseBugReport-Signature`
- Backoff: 1m, 5m, 30m, 2h, 24h; max 5 attempts
- Store in `webhook_deliveries` for debug UI

## Fair-Use Enforcement Implementation

| Tier | Monthly cap | Behavior beyond cap |
|------|-------------|---------------------|
| Free | 30 hard | HTTP 429; message includes reset date |
| Pro | 2,000 soft | HTTP 429 ingest throttle; dashboard warning at 80% |
| Studio+ | Negotiated | Sales-assist |

Per-key rate: 10/min sustained, burst 20.

## GDPR Cascade Job Order

1. Revoke API keys and ingest keys (immediate)
2. Delete R2 prefix `{orgId}/` (batch delete)
3. Delete Postgres rows (reports → projects → integrations → members → org)
4. Purge Redis keys scoped to org
5. Write audit log entry; notify owner

Target p95 completion: 72 hours.

## v2.0 Prerequisites (Recording Links + Extension)

Before recording links ship:

- Abuse spike: tokenized public URLs, CAPTCHA/rate limits, consent copy
- Consent UX research for external reporters without accounts
- Shared `capture-core` package stable from SDK v1

## Rejected Alternatives (Preserved from Brief)

| Alternative | Why rejected |
|-------------|--------------|
| Browser extension first | MV3 adds 4–6 weeks |
| Self-host OSS core | Consider OSS SDK later; not v1 |
| AI auto-title headline | Table stakes; not wedge |
| Full observability platform | Stay capture/triage |

## Implementation Sprint Sequence (Reference)

| Sprint | Focus | Exit criteria |
|--------|-------|---------------|
| S1 | Capture SDK + ingest API | 2-min replay in R2; report row in Postgres |
| S2 | Web app viewer + org auth | GitHub login; view replay |
| S3 | MCP + API keys | Agent `get_report_summary` with PAT |
| S4 | Webhooks + Linear | Report → Linear issue |
| S5 | Polish + retention + GDPR | Lifecycle rules; deletion job; rate limits |

## Persona Notes (Deferred Features)

- Maya persona references `summarize_workspace` — **deferred backlog** per council; do not implement in v1.
- Agency "unified today queue across workspaces" — partial via per-workspace list + filters; true cross-workspace analytics is Agency tier later.
