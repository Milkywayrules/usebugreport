---
depends_on:
  - 4-1-better-auth-github-oauth-and-session
  - 2-1-core-ingest-schema-and-queue-payloads
blocks:
  - 4-3-workspace-and-project-crud-with-ingest-keys
  - 2-6-usage-quotas-and-ingest-rate-limits
  - 7-1-linear-oauth-and-integrationservice-config
  - 8-1-webhook-registration-with-pro-tier-gate
---

# Story 4.6: UsageService tier limits at service boundary (AD-11)

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the platform,
I want all tier limits enforced in `UsageService` at service entry,
so that API, MCP, and ingest paths cannot bypass UI gates (AD-11 board mandate, FR-4, FR-8, FR-14, LG-8).

## Acceptance Criteria

1. **Given** tier constants in `packages/config/src/tiers.ts` as the single source of truth, **when** inspected, **then** sellable v1 tiers **Free** and **Pro** define limits matching PRD §9 and architecture §6 tier table:

   | Limit | Free | Pro |
   | --- | --- | --- |
   | Workspaces per user | 1 | 5 |
   | Reports/mo per workspace | 30 (hard cap) | 2,000 (fair-use soft cap) |
   | Integrations per workspace | 1 | unlimited (`null` sentinel) |
   | Webhooks | denied | allowed |
   | MCP/REST write | read-only (denied) | allowed |
   | Replay retention (days) | 7 | 30 |
   | Screenshot retention (days) | 7 | 90 |
   | Metadata retention (days) | 30 (stub transition) | indefinite (`null`) |

   **And** **Studio** / **Agency** stub tiers exist with documented constants (90-day replay/screenshot, unlimited workspaces/integrations, full MCP) — **defined, not sellable**, no checkout logic (PRD §9).

2. **Given** `billing_tier` persisted on workspace org rows, **when** a migration from this story (or coordinated E2-S1 handoff) is applied, **then** every workspace org has `billing_tier` enum (`free` \| `pro` \| `studio` \| `agency`) defaulting to `free`, **and** optional `retention_days_replay` / `retention_days_screenshot` columns match architecture §3.1 (nullable overrides within tier max — default from tier config when null).

3. **Given** `UsageService` exported from `packages/services/src/usage.ts` with constructor/factory accepting Drizzle db client, **when** `checkTierLimit(ctx, limitType)` is called, **then** it resolves the org's effective tier from `billing_tier`, reads limits from `@usebugreport/config/tiers`, and returns a typed result `{ allowed: true }` or `{ allowed: false, code, message, details? }` — **never throws HTTP** (adapters map codes to status).

4. **Given** `limitType: 'workspaces'` and a Free-tier user who already owns 1 workspace (count orgs where `member.user_id = ctx.userId` and `member.role = 'owner'`), **when** `checkTierLimit` runs for a create-workspace attempt, **then** `{ allowed: false, code: 'FORBIDDEN', ... }` with upgrade-oriented message (maps to HTTP 403 at adapter — AD-11).

5. **Given** `limitType: 'workspaces'` and a Pro-tier user with 5 owned workspaces, **when** checking a sixth, **then** same `FORBIDDEN` rejection at service layer.

6. **Given** `limitType: 'integrations'` and a Free-tier workspace with 1 connected integration (count rows in future `integrations` table — **unit tests use injected count fixture** until E7-S1), **when** checking a second connect, **then** `{ allowed: false, code: 'FORBIDDEN' }`.

7. **Given** `limitType: 'webhooks'` and Free tier, **when** `checkTierLimit` runs, **then** `{ allowed: false, code: 'FORBIDDEN' }`. **Given** Pro tier, **then** `{ allowed: true }`.

8. **Given** `limitType: 'mcp_write'` (alias `rest_write` acceptable — document one canonical name + re-export), **when** org tier is Free, **then** `{ allowed: false, code: 'FORBIDDEN' }` regardless of API key scope checkbox (AD-11, FR-14). **Given** Pro+, **then** `{ allowed: true }`.

9. **Given** `UsageService.checkQuota(ctx)` reading `workspace_usage_monthly` for `(organizationId, current UTC year-month)`, **when** Free tier at `report_count >= 30`, **then** `{ allowed: false, code: 'QUOTA_EXCEEDED', capKind: 'hard', details: { current, limit: 30, resetAt } }` (AD-9, FR-4).

10. **Given** Pro tier at `report_count >= 2000`, **when** `checkQuota` runs, **then** `{ allowed: false, code: 'QUOTA_EXCEEDED', capKind: 'soft', details: { current, limit: 2000, resetAt } }` — distinct `capKind` from Free hard cap (fair-use semantics for E2-S6 adapter `Retry-After`).

11. **Given** `UsageService.increment(ctx, { delta?: number })` and `getMonthlyUsage(ctx)`, **when** called against existing `workspace_usage_monthly` row from E2-S1, **then** increment is atomic (upsert + add), `getMonthlyUsage` returns `{ yearMonth, reportCount }`, and increment defaults `delta` to 1 — **called on ingest finalize in E2-S4**, not in this story's routes.

12. **Given** `UsageService.getRetentionDays(organizationId)` (or tier argument), **when** tier is Free/Pro/Studio/Agency, **then** returns `{ replayDays, screenshotDays, metadataDays }` from tier config for E2-S7 / ingest blob `expires_at` writers — **no** `recomputeRetention` batch job in this story (E2-S7).

13. **Given** `bun test packages/services/src/usage.test.ts`, **when** run, **then** unit coverage exercises **every** limit type above for Free vs Pro boundary fixtures (at-limit, under-limit, over-limit) plus Studio/Agency stub tier resolution — tests use mocked db or transactional test Postgres; no route/MCP/integration wiring required.

14. **Out of scope for this story:** HTTP route handlers, onboarding UI gates, workspace CRUD (E4-S3), ingest presign/inline quota wiring (E2-S6), MCP server (E5), IntegrationService/WebhookService consumers (E7/E8), `recomputeRetention` sweep (E2-S7), Playwright E2E, Stripe/billing checkout.

## Tasks / Subtasks

- [ ] Task 1 — Tier config single source of truth (AC: 1, 12)
  - [ ] Create `packages/config/src/tiers.ts` — export `BillingTier` union, `TIER_LIMITS` record, helpers `getTierLimits(tier)`, `getRetentionDays(tier)`, `isSellableTier(tier)`
  - [ ] Re-export from `packages/config/src/index.ts` (add `./tiers` export path in `package.json` exports if needed)
  - [ ] Document Studio/Agency as stubs with `sellable: false` flag
- [ ] Task 2 — Billing tier schema (AC: 2)
  - [ ] Add `billingTierEnum` + columns on workspace org: extend `packages/db/src/schema/` (prefer new `packages/db/src/schema/billing.ts` imported from `schema/index.ts` — **alter** existing `organization` table via new migration, do not duplicate better-auth org table)
  - [ ] Migration `packages/db/migrations/0002_*` (or next index after E2-S1): `billing_tier` NOT NULL DEFAULT `'free'`, nullable `retention_days_replay`, `retention_days_screenshot`
  - [ ] **Do not** create `workspace_usage_monthly` here — owned by E2-S1 (`2-1-core-ingest-schema-and-queue-payloads`); import schema type only
- [ ] Task 3 — UsageService core (AC: 3–12)
  - [ ] Create `packages/services/src/types.ts` — minimal `UsageContext { organizationId: string; userId?: string }`, `TierLimitType`, result discriminated unions
  - [ ] Implement `packages/services/src/usage.ts` — class or factory `createUsageService(db)` with:
    - `checkTierLimit(ctx, limitType)`
    - `checkQuota(ctx)`
    - `increment(ctx, opts?)`
    - `getMonthlyUsage(ctx)`
    - `getRetentionDays(orgId)` — loads tier from org row
    - Private helpers: `resolveOrgTier(orgId)`, `countOwnedWorkspaces(userId)`, `countIntegrations(orgId)` (integration count may accept override param for tests until `integrations` table exists)
  - [ ] Export from `packages/services/src/index.ts`; replace `servicesPlaceholder`
  - [ ] Update `packages/services/package.json` `test` script to `bun test src`
- [ ] Task 4 — Unit tests (AC: 13)
  - [ ] `packages/services/src/usage.test.ts` — table-driven tests per limit type × tier
  - [ ] Cover: Free workspace 1→2 blocked; Pro 5→6 blocked; Free integration 1→2 blocked; Pro integrations unlimited; webhooks Free denied / Pro allowed; mcp_write Free denied / Pro allowed; checkQuota hard vs soft `capKind`; increment + getMonthlyUsage against fixture row; Studio/Agency stub limits resolve
- [ ] Task 5 — Verification gate (AC: 13, DoD)
  - [ ] Run full repo verification commands in Testing Requirements

## Dev Notes

### Goal

Queue position **#4** in sprint plan — **UsageService before E4-S3 workspace CRUD** (readiness audit moved E4-S6 ahead of E4-S3 because workspace creation must consult tier limits). Delivers AD-11 service-boundary tier enforcement, tier config constants, minimal billing schema on org rows, and exhaustive unit tests. Consumers wire later.

### Scope boundary (critical)

| In E4-S6 | Deferred |
| --- | --- |
| `UsageService` + `packages/config/src/tiers.ts` | Route/MCP handler wiring |
| `checkTierLimit`, `checkQuota`, `increment`, `getMonthlyUsage`, `getRetentionDays` | `recomputeRetention` batch (E2-S7) |
| `billing_tier` columns on org + migration | Full app `organizations`/`projects` CRUD (E4-S3) |
| Unit tests `usage.test.ts` | Ingest rate limits / Redis sliding window (E2-S6) |
| Typed service results (`FORBIDDEN`, `QUOTA_EXCEEDED`) | HTTP adapter mapping in routes (E4-S3, E2-S6, E7, E8) |
| Read `workspace_usage_monthly` (E2-S1 table) | Creating `workspace_usage_monthly` migration (E2-S1) |

### Dependency: E2-S1 `workspace_usage_monthly`

Architecture §3 assigns counter table to ingest schema story:

```312:319:_bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md
#### `workspace_usage_monthly`

| Column | Type | Notes |
| --- | --- | --- |
| `organization_id` | text FK | |
| `year_month` | text | `2026-07` |
| `report_count` | int | Incremented on ingest complete |
| PK | (organization_id, year_month) | |
```

**E2-S1 owns the migration.** This story imports the Drizzle schema from `@usebugreport/db` and implements read/write helpers only. If E2-S1 is not merged when dev starts, block on E2-S1 or land schema in E2-S1 first — **do not duplicate** the table in a second migration.

Increment authority (AD-9): finalize worker calls `UsageService.increment` — implement increment here; wire caller in E2-S4/E2-S6.

### Tier limits authority (PRD §9 + architecture §6)

PRD four-tier table (sellable vs stub):

| Tier | v1 sellable | Reports/mo | Workspaces | MCP/REST | Replay retention |
| --- | --- | --- | --- | --- | --- |
| Free | yes | 30 hard | 1 | read-only | 7 days |
| Pro | yes | 2k soft | 5 | full | 30 days |
| Studio | stub | TBD at GA | unlimited | full | 90 days |
| Agency | stub | TBD at GA | unlimited | full | 90 days min at GA |

Architecture §6 tier enforcement (service entry via `checkTierLimit`):

```640:651:_bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md
### Tier enforcement (AD-11)

Enforced in `UsageService.checkTierLimit()` at **service entry**, not UI-only:

| Limit | Free | Pro | Studio / Agency (defined, not sellable v1) |
| --- | --- | --- | --- |
| Workspaces per user | 1 | 5 | Unlimited (stub) |
| Reports/mo per workspace | 30 hard | 2,000 fair-use | TBD at GA |
| Integrations | 1 | Unlimited | Unlimited |
| Webhooks | — | Pro+ | Pro+ |
| MCP/REST write | Read-only | Full | Full |
```

AD-11 spine rule:

```136:140:_bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md
### AD-11 — Tier limits enforced at service boundary
...
- **Rule:** `UsageService.checkTierLimit()` at service entry per PRD §9 ...
```

**Hard vs soft quota:** Free 30 → hard cap (`capKind: 'hard'`). Pro 2000 → fair-use soft cap (`capKind: 'soft'`) — existing reports unaffected; ingest adapter returns HTTP 429 + `Retry-After` in E2-S6. Service layer must expose distinct results; adapters choose envelope per architecture §12 (`QUOTA_EXCEEDED`).

### Current repo state (modify these)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/services/src/index.ts` | `servicesPlaceholder = true` stub | Export `createUsageService`, types |
| `packages/services/package.json` | `test`: echo stub | Real `bun test src` |
| `packages/config/src/index.ts` | env exports only | Re-export tiers |
| `packages/db/src/schema/auth.ts` | better-auth `organization` without billing | **Alter** via new migration (Task 2) |
| `packages/db/src/schema/index.ts` | auth schema only | Export billing columns / enum |
| `apps/api/src/index.ts` | imports `servicesPlaceholder` | May import real export; **no** tier route wiring |

**Do not touch:** `_bmad-output/` (except this story file already written), harness files, capture packages, auth OAuth config, onboarding middleware.

### Service API shape (implement exactly)

Architecture §5.1 catalog:

```504:504:_bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md
| `UsageService` | `packages/services/src/usage.ts` | `checkQuota`, `checkTierLimit`, `increment`, `getMonthlyUsage` |
```

Suggested signatures (adapt to project TS conventions):

```typescript
// packages/services/src/types.ts
export type TierLimitType =
  | "workspaces"
  | "integrations"
  | "webhooks"
  | "mcp_write";

export type UsageContext = {
  organizationId: string;
  userId?: string; // required for workspaces limit
};

export type TierCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      code: "FORBIDDEN" | "QUOTA_EXCEEDED";
      message: string;
      details?: Record<string, unknown>;
    };

export type QuotaCheckResult =
  | { allowed: true; current: number; limit: number | null }
  | {
      allowed: false;
      code: "QUOTA_EXCEEDED";
      capKind: "hard" | "soft";
      message: string;
      details: { current: number; limit: number; resetAt: string };
    };
```

**Workspace counting:** PRD limits workspaces **per user**, not per org. Count distinct `organization.id` where `member.user_id = ctx.userId` AND `member.role = 'owner'` (better-auth org owner role). Invited member on someone else's workspace does not count toward user's create limit.

**Integration counting:** Per `organizationId`. Until `integrations` table exists (E7-S1), implement `countIntegrations(orgId)` against DB with graceful `0` when table missing in tests, or accept test double — document for E7 consumer.

**Webhooks / MCP write:** Pure tier gate — no row count. Free → deny; Pro+ → allow.

**Year-month key:** UTC `YYYY-MM` string matching `workspace_usage_monthly.year_month`. `resetAt` in quota details = first instant of next UTC month (ISO 8601).

### Tier config file (`packages/config/src/tiers.ts`)

Single source of truth — **never** duplicate numeric limits in `usage.ts` or routes.

```typescript
export const TIER_LIMITS = {
  free: {
    sellable: true,
    maxWorkspacesPerUser: 1,
    maxReportsPerMonth: 30,
    reportCapKind: "hard" as const,
    maxIntegrationsPerWorkspace: 1,
    webhooksAllowed: false,
    mcpWriteAllowed: false,
    retention: { replayDays: 7, screenshotDays: 7, metadataDays: 30 },
  },
  pro: { /* ... */ },
  studio: { sellable: false, maxWorkspacesPerUser: null, /* unlimited */ },
  agency: { sellable: false, /* ... */ },
} as const;
```

Export `billingTierSchema` zod enum for Drizzle/pgEnum alignment.

### Billing schema strategy

Architecture §3.1 `organizations` includes `billing_tier`. E4-S1 created better-auth `organization` without billing columns:

```85:96:packages/db/src/schema/auth.ts
export const organization = pgTable(
  "organization",
  {
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    ...
    slug: text("slug").notNull().unique(),
  },
```

**Recommended:** add columns to the same physical `organization` table (1:1 with better-auth org). Use Drizzle `pgEnum` for `billing_tier`. New orgs default `free` at DB level. Tier upgrades/downgrade billing flows are out of v1 scope — tests set tier via fixtures.

Optional override columns `retention_days_replay` / `retention_days_screenshot`: when null, `getRetentionDays` uses tier defaults; when set, use `min(override, tierMax)` per architecture §3.1.

### Error codes (service → HTTP mapping for future adapters)

| Service code | HTTP | When |
| --- | --- | --- |
| `FORBIDDEN` | 403 | Tier limit: workspaces, integrations, webhooks, mcp_write |
| `QUOTA_EXCEEDED` | 429 | Monthly report cap (hard or soft) |

Adapters add architecture §12 envelope `{ error: { code, message, details, requestId } }`. **This story returns plain result objects only.**

Example quota envelope (adapter reference — not implemented here):

```867:875:_bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Free tier limit of 30 reports per month reached.",
    "details": { "resetAt": "2026-08-01T00:00:00Z", "current": 30, "limit": 30 },
    "requestId": "req_abc123"
  }
}
```

### Downstream consumers (wire later — do not implement)

| Story | Calls |
| --- | --- |
| E4-S3 workspace create | `checkTierLimit(ctx, 'workspaces')` before org insert |
| E2-S6 ingest quota | `checkQuota(ctx)` before enqueue |
| E2-S4 finalize worker | `increment(ctx)` on complete |
| E7-S1 Linear connect | `checkTierLimit(ctx, 'integrations')` |
| E8-S1 webhook register | `checkTierLimit(ctx, 'webhooks')` |
| E5/E6 MCP+REST write | `checkTierLimit(ctx, 'mcp_write')` |
| E2-S7 retention | `getRetentionDays(orgId)`; `recomputeRetention` separate |

Epic E4-S3 AC already expects service rejection:

```80:86:_bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E04-auth-rbac.md
**Given** Free tier user already owning 1 workspace
**When** creating second workspace via `/settings/workspaces`
**Then** `UsageService.checkTierLimit('workspaces')` returns HTTP 403 or 422 with upgrade message — **service boundary**, not UI-only
```

### Previous story intelligence

**E4-S1 (`4-1-better-auth-github-oauth-and-session.md`) — done:**

- Auth migration `0000_perfect_dreaming_celestial.sql`; tables `organization`, `member`, `user`, etc.
- Session probe exposes org membership list for E4-S2
- Explicitly deferred UsageService to E4-S6
- Integration tests pattern: Docker Postgres, skip without `DATABASE_URL`
- `@usebugreport/db` real Drizzle client at `packages/db/src/index.ts`

**E2-S1 (dependency — drafted/developed immediately before this story):**

- Owns `reports`, `report_blobs`, `workspace_usage_monthly`, queue payload types
- Do not re-create ingest tables here

**Git baseline:** `a2faaca` — auth foundation on Elysia + better-auth.

### Anti-patterns (do not do)

- Do not enforce tier limits only in Next.js UI or middleware without service calls
- Do not hardcode `30` / `2000` / `5` outside `packages/config/src/tiers.ts`
- Do not duplicate `workspace_usage_monthly` migration
- Do not add Drizzle queries to `apps/api/src/routes` for tier checks (AD-1 — services only)
- Do not implement Stripe/checkout or tier upgrade flows
- Do not throw raw errors from service methods — return discriminated results
- Do not wire ingest/MCP/webhook routes in this story
- Do not commit secrets or modify `.env`

### Project Structure Notes

New / modified files (expected):

```text
packages/config/src/tiers.ts
packages/config/package.json                    # exports field if needed
packages/db/src/schema/billing.ts             # enum + org column defs (or extend auth.ts)
packages/db/migrations/0002_*_billing_tier.sql
packages/services/src/types.ts
packages/services/src/usage.ts
packages/services/src/usage.test.ts
packages/services/src/index.ts
packages/services/package.json
```

Aligns with architecture §2: domain logic in `packages/services`; constants in `packages/config`; schema in `packages/db`.

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E04-auth-rbac.md#Story E4-S6]
- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E02-ingest-pipeline-storage.md#Story E2-S1 — workspace_usage_monthly]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-11]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#3.1 Core entities — organizations billing_tier]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#5.1 Service catalog — UsageService]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#6. Tier enforcement]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#7. Retention authority]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#12. API Conventions — QUOTA_EXCEEDED envelope]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/prd.md#9. Monetization]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/prd.md#FR-4 — hard vs soft cap]
- [Source: _bmad-output/implementation-artifacts/sprint-plan-2026-07-20.md#Launch Queue — E4-S6 position 4]
- [Source: _bmad-output/implementation-artifacts/4-1-better-auth-github-oauth-and-session.md]

## Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
bun install
bun run db:migrate                    # applies billing + assumes E2-S1 usage table present
bunx biome check .
bunx turbo run lint typecheck test build

# UsageService unit tests (primary gate for this story)
bun test packages/services/src/usage.test.ts

# Optional: full services package
bun --cwd packages/services test
```

**Required unit coverage (`usage.test.ts`):**

| Area | Cases |
| --- | --- |
| `getTierLimits` | Free, Pro, Studio, Agency constants match PRD §9 |
| `checkTierLimit` → workspaces | Free: 0 ok, 1 at cap blocks 2nd; Pro: 4 ok, 5 blocks 6th |
| `checkTierLimit` → integrations | Free: 0 ok, 1 blocks; Pro: 100 ok (unlimited) |
| `checkTierLimit` → webhooks | Free deny; Pro allow |
| `checkTierLimit` → mcp_write | Free deny; Pro allow; Studio stub allow |
| `checkQuota` | Free: 29 ok, 30 blocks hard; Pro: 1999 ok, 2000 blocks soft; verify distinct `capKind` |
| `increment` / `getMonthlyUsage` | Upsert row, increment by 1 and N, read back correct count |
| `getRetentionDays` | Free 7/7/30; Pro 30/90/null; Studio stub 90/90 |

**Test DB strategy:** Prefer in-memory mocked Drizzle queries for speed; optional integration test with Docker Postgres + E2-S1 schema when `DATABASE_URL` set (same convention as E4-S1 auth tests).

**Not required this story:** Playwright, MCP parity tests, ingest E2E, route HTTP status assertions.

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `packages/config/src/tiers.ts` is sole numeric limit source; Studio/Agency stubs documented
- [ ] `billing_tier` migration applies on org table; default `free`
- [ ] `UsageService` methods implemented with typed results (no HTTP in service layer)
- [ ] `checkQuota` distinguishes `capKind: 'hard' | 'soft'`
- [ ] `workspace_usage_monthly` read/write works against E2-S1 schema (no duplicate migration)
- [ ] `bun test packages/services/src/usage.test.ts` — all tier boundary cases pass
- [ ] `turbo lint typecheck test build` exit 0
- [ ] No route/MCP/workspace CRUD wiring introduced
- [ ] Story status moved to `review` by dev agent; code-review marks `done`

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20: Story 4.6 drafted — UsageService AD-11 tier enforcement at service boundary
