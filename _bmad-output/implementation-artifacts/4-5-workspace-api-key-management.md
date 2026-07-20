---
baseline_commit: 692ccc4
depends_on:
  - 4-1-better-auth-github-oauth-and-session
  - 4-4-project-level-rbac
  - 4-6-usageservice-tier-limits-at-service-boundary-ad-11
blocks:
  - 6-3-rest-report-endpoints
  - 5-1-mcp-streamable-http-transport-and-auth
  - 8-1-webhook-registration-with-pro-tier-gate
  - 9-1-deletion-tombstone-enqueue-and-key-revocation
---

# Story 4.5: Workspace API key management

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a workspace admin,
I want to create, rotate, and revoke API keys with scopes,
so that agents authenticate without embedding secrets in browsers (FR-22, FR-23, LG-3).

## Acceptance Criteria

1. **Given** migration `0005_*` applied, **when** schema is inspected, **then** table `workspace_api_keys` exists per architecture §3.1 with columns: `id` (text PK, `wak_*`), `organization_id` (FK → `organization.id`), `name` (text), `key_hash` (text), `key_prefix` (text, display suffix), `scopes` (text[]), `last_used_at` (timestamptz nullable), `revoked_at` (timestamptz nullable), `expires_at` (timestamptz nullable), `created_at` (timestamptz); **and** index `workspace_api_keys_org_id_idx` on `organization_id`; **and** partial index or query pattern for active keys (`revoked_at IS NULL`).

2. **Given** better-auth `apikey` table from migration `0000`, **when** a workspace API key is created, **then** a linked row is inserted with the **same** `id`, `reference_id = organization_id`, `prefix = 'ubr_live_'`, hashed `key`, optional `expires_at`, `enabled = true`, and `metadata` JSON holding `{ workspaceApiKeyId, scopes }` for plugin compatibility (architecture: "Managed via better-auth `apiKey()` plugin metadata; app table mirrors for scopes and last-used"); **and** `apps/api/src/__tests__/auth-migration.test.ts` expectation updated — `workspace_api_keys` must exist after this migration.

3. **Given** org admin on `POST /api/v1/workspaces/:organizationId/api-keys` with body `{ name, scopes, expiresAt? }`, **when** create succeeds, **then** full plaintext `ubr_live_*` returned **once** in `{ apiKey, keyPlaintext }`; **and** list endpoint returns masked rows `{ id, name, keyPrefix, scopes, lastUsedAt, expiresAt, createdAt, revokedAt: null }` — never plaintext (FR-22).

4. **Given** scope checkboxes on create UI and API validation, **when** key is created, **then** allowed scope values are exactly: `reports:read`, `reports:write`, `mcp:tools`, `webhooks:manage` (FR-22); **and** at least one scope required; **and** unknown scope values → **422** `VALIDATION_ERROR`.

5. **Given** Free-tier workspace (`organization.billing_tier = 'free'`), **when** create request includes `reports:write` and/or `webhooks:manage`, **then** HTTP **403** `FORBIDDEN` at service layer with upgrade message — not UI-only (architecture §6 AD-11: "Free tier: scopes limited to `reports:read`, `mcp:tools`"); **and** UI disables write/webhook checkboxes with Pro upgrade tooltip (EXPERIENCE.md).

6. **Given** Pro-tier workspace, **when** admin selects any valid scope combination, **then** create succeeds; **and** runtime write operations still call `UsageService.checkTierLimit(ctx, 'mcp_write')` at service entry (AD-11) — scope checkbox alone does not bypass tier (document in service, full write routes land E6/E10).

7. **Given** `POST /api/v1/workspaces/:organizationId/api-keys/:keyId/rotate`, **when** rotation completes, **then** prior row gets `revoked_at = now()` and linked `apikey.enabled = false`; **and** new active row + linked `apikey` row created; **and** new plaintext shown once; **and** old key fails middleware immediately (**401** `UNAUTHORIZED`) (FR-23).

8. **Given** `DELETE /api/v1/workspaces/:organizationId/api-keys/:keyId` (revoke), **when** completes, **then** `revoked_at` set, `apikey.enabled = false`; **and** subsequent Bearer use → **401** (FR-23).

9. **Given** optional `expiresAt` on create, **when** current time > `expires_at`, **then** middleware rejects key with **401** `UNAUTHORIZED` (FR-23); **and** non-expired keys with null `expires_at` remain valid indefinitely.

10. **Given** any authenticated `/api/v1/*` request with `Authorization: Bearer ubr_live_*` (excluding `/api/v1/capture/*` — ingest keys only), **when** middleware validates, **then** `workspace_api_keys.last_used_at` updated to `now()` (sync `apikey.last_request` if practical); **and** `AuthContext` resolved as `{ type: 'api_key', organizationId, apiKeyId, scopes, projectIds }` where `projectIds` = all project IDs in the org (agent workspace-wide access within scopes — E4-S4 handoff); **and** no `userId` on API-key context (FR-23).

11. **Given** API key middleware in `apps/api/src/middleware/api-key-auth.ts`, **when** wired on `/api/v1/*` routes (and exportable for future `/mcp`), **then** session cookie auth and Bearer `ubr_live_*` are both accepted where routes allow either; **and** missing/invalid/revoked/expired/wrong-prefix token → **401** with standard error envelope `{ error: { code: 'UNAUTHORIZED', message, requestId } }`; **and** ingest prefix `ubr_ingest_*` on non-capture paths → **401** (wrong auth mode).

12. **Given** org admin session on `/w/[slug]/settings/api-keys`, **when** page loads, **then** Mantine `Table` lists keys (name, prefix, scopes badges, last used relative time, expiry if set); **and** create `Modal` with scope `Checkbox.Group`, optional expiry `DateTimePicker`, name `TextInput`; **and** on create success show full key once with `CopyButton` + "I've saved this" dismiss (EXPERIENCE.md); **and** rotate/revoke actions with confirm `Modal`; **and** nav link visible only for org admin (hide for non-admins — no permission-denied page).

13. **Given** non-admin org member, **when** calling API key CRUD routes or visiting `/w/[slug]/settings/api-keys`, **then** **403** `FORBIDDEN` (architecture §6: Settings/API keys ≥ org admin).

14. **Given** API key for org A, **when** used against org B resource paths or org B's key validated against org A route param, **then** **401** or **403** — cross-org isolation (AD-3); integration test required.

15. **Given** scope enforcement helper `requireApiKeyScope(ctx, scope)`, **when** key lacks `reports:read`, **then** **403** on read probe; **when** key lacks `mcp:tools`, **then** **403** on MCP-capable probe — implement helper in services or middleware for E5/E6 reuse.

16. **Given** `bun test packages/services/src/api-key.test.ts`, **when** run, **then** unit coverage: create/rotate/revoke, hash verify, Free-tier scope rejection at create, expiry validation, last-used update, cross-org service guard.

17. **Given** `apps/api/src/__tests__/api-key-auth.integration.test.ts` with Docker Postgres, **when** run, **then** fixtures seed two orgs + keys; verify: valid key **200** on probe, revoked **401**, expired **401**, wrong org **401/403**, missing scope **403**, cross-org **401/403**, last_used_at advances.

18. **Given** Playwright `e2e/api-key-management.spec.ts`, **when** org admin runs create flow, **then** modal → scopes selected → plaintext shown once → dismiss → list shows prefix/scopes; rotate shows new plaintext once; revoke removes active status.

19. **Out of scope for this story:** REST report/MCP tool routes (E6-S3, E5-S1 — consume middleware only); ingest key changes (E4-S3 pattern stays separate); webhook registration UI (E8); Stripe/billing; API key rate limits (better-auth `apikey` rate limit columns exist — wire later if needed); agent comment attribution UI (E10-S2); GDPR key revocation job (E9-S1 — reuse revoke service method); Playwright for MCP transport.

## Tasks / Subtasks

- [x] Task 1 — Schema migration `0005` (AC: 1, 2)
  - [x] Add `workspaceApiKeys` table to `packages/db/src/schema/` (new `api-keys.ts` or extend `auth.ts` — prefer dedicated file + export from `schema/index.ts`)
  - [x] Generate `packages/db/migrations/0005_workspace_api_keys.sql`
  - [x] Migration test `packages/db/src/__tests__/workspace-api-keys-migration.test.ts` (skip without `DATABASE_URL`)
  - [x] Update `apps/api/src/__tests__/auth-migration.test.ts` — expect `workspace_api_keys` present

- [x] Task 2 — ApiKeyService + AuthContext extension (AC: 3–9, 10, 16)
  - [x] Extend `packages/services/src/types.ts`:
    - `AuthContext.type`: `'session' | 'api_key'`
    - `userId` optional when `type === 'api_key'`
    - Add `scopes?: ApiKeyScope[]`, `ApiKeyScope` union
  - [x] Implement `packages/services/src/api-key.ts` — `createApiKeyService(db, deps?)` with:
    - `listApiKeys(ctx)`, `createApiKey(ctx, { name, scopes, expiresAt? })`, `rotateApiKey(ctx, keyId)`, `revokeApiKey(ctx, keyId)`
    - `validateApiKey(plaintext)`, `touchLastUsed(keyId)`
    - `requireOrgAdmin(ctx)` for mutations (reuse workspace guard pattern)
    - Free-tier scope gate before insert
    - Plaintext generator `ubr_live_` + base62 (mirror `generateIngestKeyPlaintext` pattern in `project.ts`)
    - Hash via `Bun.password.hash` / verify (reuse or extract shared helper with ingest)
    - Transaction: insert `workspace_api_keys` + sync `apikey` row (same id)
  - [x] Export `requireApiKeyScope(ctx, scope)` helper
  - [x] Unit tests `packages/services/src/api-key.test.ts`
  - [x] Export from `packages/services/src/index.ts`

- [x] Task 3 — API key auth middleware (AC: 10, 11, 14, 15)
  - [x] Create `apps/api/src/middleware/api-key-auth.ts`:
    - Parse `Authorization: Bearer …`
    - Accept only `ubr_live_*` prefix
    - Resolve via `ApiKeyService.validateApiKey` → build `AuthContext`
    - Load all org `projectIds` from `projects` table
    - Update `last_used_at` on success
    - Export `requireApiKeyAuth(context)`, `requireSessionOrApiKey(context)`, `requireApiKeyScope(scope)`
  - [x] Extend `apps/api/src/middleware/auth-context.ts` if needed — do not break session path
  - [x] Wire middleware derive on `/api/v1` route group in `apps/api/src/index.ts`

- [x] Task 4 — REST routes (AC: 3, 5, 7, 8, 13)
  - [x] Create `apps/api/src/routes/api-keys.ts`:
    - `GET /api/v1/workspaces/:organizationId/api-keys`
    - `POST /api/v1/workspaces/:organizationId/api-keys`
    - `POST /api/v1/workspaces/:organizationId/api-keys/:keyId/rotate`
    - `DELETE /api/v1/workspaces/:organizationId/api-keys/:keyId`
  - [x] Session auth + `resolveAuthContext` + org admin gate on all handlers
  - [x] Map `ServiceError` → HTTP via `apps/api/src/lib/errors.ts`
  - [x] Add non-production probe `GET /api/v1/auth/context-probe` (session **or** api key) returning `{ type, organizationId, scopes?, projectIds? }` for integration tests — **404 in production** (pattern from `protected-probe`)

- [x] Task 5 — Web UI (AC: 12, 13)
  - [x] Create `apps/web/src/app/(app)/w/[slug]/settings/api-keys/page.tsx` + client component
  - [x] Server loader fetches keys from API; server actions or client fetch for CRUD
  - [x] Create modal: scope checkboxes, optional expiry, name; show-once modal after create/rotate
  - [x] Add settings nav link in workspace settings layout or hub (admin only)
  - [x] Add header/layout nav link for org admins → `/w/[slug]/settings/api-keys` (mirror members link pattern in `(app)/layout.tsx`)
  - [x] Free tier: disable write/webhook scopes in UI with upgrade `Tooltip`

- [x] Task 6 — Tests + verification (AC: 16–18, DoD)
  - [x] Integration tests `apps/api/src/__tests__/api-key-auth.integration.test.ts`
  - [x] Playwright `e2e/api-key-management.spec.ts` — extend `e2e/fixtures/session.ts` if needed
  - [x] Run full verification commands in Testing Requirements

## Dev Notes

### Goal

Queue position **#8** in sprint plan — **E4-S4 (project RBAC) is done**. Delivers FR-22/FR-23 workspace agent API keys (`ubr_live_*`): `workspace_api_keys` schema, dual-table sync with better-auth `apikey`, `ApiKeyService`, Bearer middleware for `/api/v1`, org-admin CRUD REST routes, settings UI, and tests. **Foundation for E6 REST, E5 MCP, E8 webhooks** — those epics consume this middleware; do not implement report/MCP routes here.

### Scope boundary (critical)

| In E4-S5 | Deferred |
| --- | --- |
| `workspace_api_keys` migration `0005` + better-auth `apikey` sync | Report REST endpoints (E6-S3) |
| `ApiKeyService` create/rotate/revoke/validate/touch | MCP Streamable HTTP server (E5-S1) |
| Bearer middleware + `AuthContext` `api_key` type | Surface registry / OpenAPI (E6-S2) |
| Scope + tier-at-create enforcement | Write route tier checks beyond probe (E6 — call `UsageService.checkTierLimit`) |
| `/w/[slug]/settings/api-keys` UI | Webhook registration (E8-S1) |
| REST CRUD under `/api/v1/workspaces/.../api-keys` | GDPR bulk revoke worker (E9-S1 — reuse `revokeApiKey`) |
| `requireApiKeyScope` helper + context probe route | Agent comment attribution (E10-S2) |
| Unit + integration + Playwright key management | Ingest key middleware (E2-S2 — separate `ubr_ingest_*` path) |

**Ingest vs live keys (do not conflate):**

| Aspect | Ingest (`ubr_ingest_*`) | Workspace API (`ubr_live_*`) |
| --- | --- | --- |
| Table | `ingest_keys` only | `workspace_api_keys` + `apikey` sync |
| Scope | Single project write | Organization |
| Auth path | `/api/v1/capture/*` only (E2-S2) | `/api/v1/*`, `/mcp` |
| Service | `ProjectService.validateIngestKey` | `ApiKeyService.validateApiKey` |
| better-auth plugin | Not used | `apiKey()` plugin row linked |

### Current repo state (modify / extend)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/db/src/schema/auth.ts` | `apikey` table (migration 0000) | No schema change to `apikey`; add `workspace_api_keys` |
| `packages/db/src/schema/projects.ts` | projects, ingest_keys, project_members | Unchanged |
| `packages/services/src/types.ts` | `AuthContext` session-only `type: 'session'` | Add `'api_key'`, optional `userId`, `scopes` |
| `packages/services/src/project.ts` | Ingest key hash/generate helpers | Reuse pattern; optional extract shared `hashSecret` if DRY without scope creep |
| `packages/services/src/usage.ts` | `checkTierLimit(..., 'mcp_write')` | Called at key create for Free scope gate; document for future write routes |
| `packages/config/src/tiers.ts` | `mcpWriteAllowed`, `webhooksAllowed` | Source for Free-tier scope UI + service gate |
| `apps/api/src/lib/auth.ts` | `apiKey()` plugin registered | Use on create/revoke sync; no config change required unless plugin options needed |
| `apps/api/src/middleware/auth-context.ts` | Session → orgRole, projectIds | Keep; API key middleware parallel path |
| `apps/api/src/middleware/session.ts` | Cookie session derive | Unchanged |
| `apps/api/src/index.ts` | Session-only `/api/v1` routes | Wire api-key middleware + new routes |
| `apps/api/src/__tests__/auth-migration.test.ts` | Asserts `workspace_api_keys` absent | Update to assert present |
| `apps/web/.../settings/api-keys/` | **Missing** | New page + components |
| `apps/web/src/app/(app)/layout.tsx` | Members link for org admin | Add API keys link |

**Do not touch:** capture packages, worker, RBAC matrix logic (except consuming extended AuthContext), `_bmad-output/` except sprint-status, ingest routes.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| §3.1 `workspace_api_keys` | Columns per architecture; scopes text[]; show-once plaintext |
| §5 / §6 API key auth | `ubr_live_*` → org scope; middleware before service; tier Free read-only scopes at create |
| AD-3 | All service methods take `AuthContext` first; `organizationId` on every query |
| AD-11 | Free: only `reports:read` + `mcp:tools` at create; `UsageService.checkTierLimit(..., 'mcp_write')` on writes |
| FR-22 | Admin CRUD, scopes, prefix, hashed storage, list metadata |
| FR-23 | last_used_at, revoke/expiry → 401, bearer auth |
| §12 errors | `{ error: { code, message, requestId } }` — 401 UNAUTHORIZED, 403 FORBIDDEN |
| EXPERIENCE.md | `/w/[slug]/settings/api-keys`; create Modal + CopyButton; list prefix/scopes/last used |
| E4-S4 handoff | `AuthContext.projectIds` for API keys = all projects in org |

### ApiKeyScope model

```typescript
export type ApiKeyScope =
  | "reports:read"
  | "reports:write"
  | "mcp:tools"
  | "webhooks:manage";

export const API_KEY_SCOPES: ApiKeyScope[] = [
  "reports:read",
  "reports:write",
  "mcp:tools",
  "webhooks:manage",
];

/** Free tier: only these scopes may be assigned at create (architecture §6). */
export const FREE_TIER_API_KEY_SCOPES: ApiKeyScope[] = [
  "reports:read",
  "mcp:tools",
];
```

### AuthContext shape (post E4-S5)

```typescript
export interface AuthContext {
  type: "session" | "api_key";
  organizationId: string;
  userId?: string; // required for session; absent for api_key
  orgRole?: OrgRole;
  projectIds?: string[];
  apiKeyId?: string;
  scopes?: ApiKeyScope[];
  requestId?: string;
}
```

Session middleware: unchanged — still sets `type: 'session'` + `userId`.

API key middleware:

```text
Authorization: Bearer ubr_live_…
  → validate hash + not revoked + not expired
  → organizationId from workspace_api_keys.organization_id
  → projectIds = SELECT id FROM projects WHERE organization_id = …
  → scopes from workspace_api_keys.scopes
  → touch last_used_at
  → attach AuthContext
```

### Dual-table sync (better-auth + app mirror)

Architecture requires both. Recommended create flow:

```text
BEGIN;
  INSERT workspace_api_keys (id, organization_id, name, key_hash, key_prefix, scopes, expires_at, …)
  INSERT apikey (id, reference_id=organization_id, prefix='ubr_live_', key=<hash>, expires_at, enabled=true, metadata=JSON, name)
COMMIT;
```

Revoke/rotate: set `workspace_api_keys.revoked_at` **and** `apikey.enabled = false` on old row.

**Validation path:** Prefer `Bun.password.verify(plaintext, workspace_api_keys.key_hash)` against active rows (consistent with ingest_keys). Sync hash to `apikey.key` on create so better-auth plugin state stays consistent for future tooling.

### REST route sketch

| Method | Path | Auth | Min access |
| --- | --- | --- | --- |
| GET | `/api/v1/workspaces/:organizationId/api-keys` | Session | Org admin |
| POST | `/api/v1/workspaces/:organizationId/api-keys` | Session | Org admin |
| POST | `/api/v1/workspaces/:organizationId/api-keys/:keyId/rotate` | Session | Org admin |
| DELETE | `/api/v1/workspaces/:organizationId/api-keys/:keyId` | Session | Org admin |
| GET | `/api/v1/auth/context-probe` | Session **or** Bearer | Any valid auth (non-prod or always — prefer non-prod) |

Response create (201):

```json
{
  "apiKey": { "id": "wak_…", "name": "CI", "keyPrefix": "…abc12345", "scopes": ["reports:read", "mcp:tools"], "expiresAt": null, "createdAt": "…" },
  "keyPlaintext": "ubr_live_…",
  "requestId": "…"
}
```

### Middleware wiring sketch (Elysia)

Apply to future `/api/v1` group — **exclude** `/api/v1/capture/*`:

```typescript
// derive apiKeyContext from Authorization header
// routes choose requireSession OR requireApiKey OR either via helper
```

Capture routes (E2-S2) use ingest middleware only — never accept `ubr_live_*` on capture paths.

### UX surfaces (Mantine)

| Route | Components | Notes |
| --- | --- | --- |
| `/w/[slug]/settings/api-keys` | `Table`, create `Modal`, `Checkbox.Group`, `CopyButton`, `Badge` scopes | Admin only; hide nav for others |
| Create success | Second `Modal` or step | Full key once + "I've saved this" |
| Rotate | Confirm `Modal` | Same show-once pattern |
| Revoke | Confirm `Modal` destructive | Row shows revoked or removed from active list |

Reference ingest key UX in `apps/web/src/app/(app)/w/[slug]/projects/[id]/project-detail.tsx` for CopyButton/show-once patterns — **do not** reuse ingest key API routes.

### Tier + scope enforcement matrix

| Tier | Allowed scopes at create | Runtime write (future E6/E5) |
| --- | --- | --- |
| Free | `reports:read`, `mcp:tools` only | `UsageService.checkTierLimit(..., 'mcp_write')` → 403 on writes |
| Pro+ | All four scopes | Writes allowed when scope + tier pass |

### Previous story intelligence

**E4-S4 (`4-4-project-level-rbac.md`):**

- Extended `AuthContext` with `orgRole`, `projectIds`, stub `apiKeyId?` — **implement api_key type now**
- `resolveAuthContext` in `apps/api/src/middleware/auth-context.ts` — session only; add parallel API key resolver
- Org admin gate pattern: `requireOrgAdmin` on workspace members list (review fix) — reuse for API key CRUD
- Integration test pattern: direct DB seed + signed cookie in `project-rbac.integration.test.ts`
- Playwright: Mantine modal selectors, `CI=1` serial workers

**E4-S3 (`4-3-workspace-and-project-crud-with-ingest-keys.md`):**

- Ingest key: `ubr_ingest_` + `Bun.password.hash`, show-once, rotate revokes old row
- **Do not** route workspace keys through `ProjectService` — separate service

**E4-S1 (`4-1-better-auth-github-oauth-and-session.md`):**

- `apiKey()` plugin already in `apps/api/src/lib/auth.ts`
- `apikey` table columns: `key`, `prefix`, `referenceId`, `expiresAt`, `lastRequest`, `enabled`, `metadata`

**E4-S6 (`4-6-usageservice-tier-limits-at-service-boundary-ad-11.md`):**

- `checkTierLimit(ctx, 'mcp_write')` for Free → FORBIDDEN
- Tier from `organization.billing_tier` via `UsageService`

**Git (baseline 692ccc4):** `feat: enforce project-level roles with deny-by-default checks` — RBAC + auth-context patterns to extend.

### Anti-patterns (do not do)

- Do not store plaintext keys in DB, logs, or error messages
- Do not use `ubr_live_*` for capture/ingest paths — keep ingest middleware separate
- Do not skip better-auth `apikey` sync — architecture requires plugin linkage
- Do not grant API key CRUD to org `member` role — org admin/owner only
- Do not implement report list/detail REST routes in this story — probe route only
- Do not bypass Free-tier scope limits at create because UI hid checkboxes — enforce in service
- Do not use Radix — Mantine only
- Do not commit secrets or `.env`

### Project structure (new / updated files)

```text
packages/db/src/schema/api-keys.ts                           # NEW — workspaceApiKeys
packages/db/migrations/0005_workspace_api_keys.sql         # NEW
packages/db/src/__tests__/workspace-api-keys-migration.test.ts # NEW
packages/db/src/schema/index.ts                            # UPDATE — export
packages/services/src/api-key.ts                           # NEW
packages/services/src/api-key.test.ts                      # NEW
packages/services/src/types.ts                             # UPDATE — AuthContext, ApiKeyScope
packages/services/src/index.ts                             # UPDATE — exports
apps/api/src/middleware/api-key-auth.ts                    # NEW
apps/api/src/routes/api-keys.ts                            # NEW
apps/api/src/index.ts                                      # UPDATE — wire middleware + routes
apps/api/src/__tests__/api-key-auth.integration.test.ts    # NEW
apps/api/src/__tests__/auth-migration.test.ts              # UPDATE
apps/web/src/app/(app)/w/[slug]/settings/api-keys/page.tsx # NEW
apps/web/src/app/(app)/w/[slug]/settings/api-keys/api-keys-settings.tsx # NEW
apps/web/src/app/(app)/layout.tsx                          # UPDATE — nav link
apps/web/src/lib/api-server.ts                             # UPDATE — fetch helpers if needed
e2e/api-key-management.spec.ts                             # NEW
```

### Latest technical notes (better-auth apiKey plugin)

- Plugin already registered: `@better-auth/api-key` in `apps/api/src/lib/auth.ts`
- `apikey.referenceId` → use `organization.id` for workspace-scoped keys
- `apikey.prefix` → store `ubr_live_` (plugin may also store start/prefix fields — align with ingest display using last 8 chars in `key_prefix`)
- Expiry: set `expiresAt` on both tables; middleware checks `expires_at <= now()`
- Last used: app table `last_used_at` is authoritative for UI; update every successful auth (architecture FR-23)
- Docs: [better-auth API key plugin](https://better-auth.com/docs/plugins/api-key) — verify create/verify API surface when implementing sync; prefer server-side `auth.api` calls over duplicating hash algorithm if plugin provides verify

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E04-auth-rbac.md#Story E4-S5]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/prd.md#FR-22, FR-23]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§3.1 workspace_api_keys, §6 API key auth, AD-11]
- [Source: _bmad-output/planning-artifacts/ux-usebugreport-2026-07-20/EXPERIENCE.md — /w/[slug]/settings/api-keys, API key create Modal]
- [Source: _bmad-output/implementation-artifacts/4-4-project-level-rbac.md — AuthContext handoff]
- [Source: _bmad-output/implementation-artifacts/4-3-workspace-and-project-crud-with-ingest-keys.md — ingest key patterns]
- [Source: _bmad-output/implementation-artifacts/sprint-plan-2026-07-20.md — position 8]
- [Source: packages/db/src/schema/auth.ts — apikey table]
- [Source: packages/services/src/project.ts — hash/generate patterns]
- [Source: packages/config/src/tiers.ts — Free vs Pro gates]
- [Source: apps/api/src/lib/auth.ts — apiKey plugin]

## Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
docker compose -f docker/docker-compose.dev.yml up postgres -d

bun install
bun run db:migrate
bunx biome check .
bunx turbo run lint typecheck test build

# ApiKeyService unit tests
bun test packages/services/src/api-key.test.ts

# Schema migration
DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:5432/usebugreport \
  bun test packages/db/src/__tests__/workspace-api-keys-migration.test.ts

# API key auth integration
DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:5432/usebugreport \
  bun test apps/api/src/__tests__/api-key-auth.integration.test.ts

# Playwright key management flow
bunx playwright test e2e/api-key-management.spec.ts
```

**Required integration coverage:**

| Case | Expected |
| --- | --- |
| Valid Bearer `ubr_live_*` on context-probe | 200 + `type: 'api_key'` + scopes |
| Revoked key | 401 `UNAUTHORIZED` |
| Expired key | 401 `UNAUTHORIZED` |
| Wrong prefix (`ubr_ingest_*` on v1 probe) | 401 |
| Key for org A on org B probe param | 401 or 403 |
| Key without `reports:read` on read-scope probe | 403 `FORBIDDEN` |
| Session org admin create key | 201 + plaintext once |
| Free org create with `reports:write` | 403 `FORBIDDEN` |
| Org member (non-admin) list keys | 403 |
| Rotate old key | old 401, new 200 |
| last_used_at before/after request | timestamp advances |

**Required Playwright coverage (AC18):**

| Step | Expected |
| --- | --- |
| Org admin opens `/w/[slug]/settings/api-keys` | Table + Create button |
| Create with scopes | Show-once modal with CopyButton |
| Dismiss show-once | List shows prefix + scope badges |
| Rotate | New show-once modal |
| Revoke | Key inactive in list |

## Definition of Done

- [x] All acceptance criteria met
- [x] Migration `0005` applied cleanly after `0000`–`0004`
- [x] Dual-table create/revoke/rotate with better-auth `apikey` sync
- [x] Bearer middleware resolves `AuthContext` for `/api/v1` (foundation for E5/E6)
- [x] Free-tier scope gate at service create + disabled UI checkboxes
- [x] Settings UI at `/w/[slug]/settings/api-keys` per EXPERIENCE.md
- [x] `turbo lint typecheck test build` exit 0
- [x] Integration + Playwright tests pass
- [x] Story status moved to `review` by dev agent; code-review marks `done`

### Review Findings

**Code review (2026-07-20):** verdict **approved** after fixes below.

**Fixed during review:**
- [x] [Review][Patch] E2e revoke targeted pre-rotate `keyId`; rotate creates new id — `e2e/api-key-management.spec.ts`
- [x] [Review][Patch] Free-tier scope gate missing on `rotateApiKey` — `packages/services/src/api-key.ts`
- [x] [Review][Patch] `touchLastUsed` errors could fail auth — wrapped best-effort in `buildAuthContextFromApiKey`
- [x] [Review][Patch] Migration test timed out at 5s — raised to 60s for turbo `db:migrate`

**Deferred / noted:**
- [x] [Review][Defer] `validateApiKey` scans all active keys with bcrypt (O(n)) — acceptable at current scale; add prefix/index lookup when key volume grows [`packages/services/src/api-key.ts`]
- [x] [Review][Defer] API-key RBAC resolves `admin` on all org `projectIds` — intentional per AC10; route-level `requireApiKeyScope` is the enforcement boundary [`packages/services/src/rbac.ts`]

**Dev environment — Postgres port 5432 conflict:** host port 5432 was occupied by another project's container. Use `docker compose -f docker/docker-compose.dev.yml -f docker/docker-compose.dev.override-port.yml up postgres -d` and `DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:55432/usebugreport` for migrations/tests/e2e.

**Verification (review run):**
- `bunx turbo run lint typecheck build test` — pass
- migrations 0000–0005 on port 55432 — pass
- `bun test` api-key unit + migration + integration (26 tests) — pass
- `CI=1 bunx playwright test` — pass (incl. api-key spec)

**Security checks:**
- Plaintext returned once on create/rotate only; list/masked; no logger calls near key material
- bcrypt cost 10; dual-table create/revoke/rotate in transactions (no ghost-valid desync)
- Free-tier write/webhook scopes blocked server-side at create and rotate
- Revoked/expired/wrong-prefix/cross-org → 401/403; probe routes 404 in production (`NODE_ENV`)
- `projectIds` loaded from org projects table only — cannot exceed workspace scope

## Dev Agent Record

### Agent Model Used

Composer (dev subagent)

### Debug Log References

- Playwright e2e: Mantine Modal root `data-testid` stays aria-hidden while dialog is open — spec uses `getByRole('dialog')` instead.

### Completion Notes List

- Added migration `0005` + `workspace_api_keys` schema synced with better-auth `apikey` on create/rotate/revoke.
- `ApiKeyService`: `ubr_live_*` bcrypt hash, Free-tier scope gate, org-admin CRUD, `requireApiKeyScope`.
- Bearer middleware + non-prod context/scope probes; REST CRUD under `/api/v1/workspaces/:orgId/api-keys`.
- Settings UI at `/w/[slug]/settings/api-keys` with show-once copy, Free-tier disabled scopes.
- Extended `AuthContext` for `api_key` type; `requireSessionUserId` guards session-only services.

### File List

- packages/db/src/schema/api-keys.ts
- packages/db/migrations/0005_workspace_api_keys.sql
- packages/db/migrations/meta/_journal.json
- packages/db/src/schema/index.ts
- packages/db/src/index.ts
- packages/db/src/__tests__/workspace-api-keys-migration.test.ts
- packages/services/src/types.ts
- packages/services/src/api-key.ts
- packages/services/src/api-key.test.ts
- packages/services/src/index.ts
- packages/services/src/workspace.ts
- packages/services/src/project.ts
- packages/services/src/rbac.ts
- apps/api/src/middleware/api-key-auth.ts
- apps/api/src/routes/api-keys.ts
- apps/api/src/index.ts
- apps/api/src/__tests__/api-key-auth.integration.test.ts
- apps/api/src/__tests__/auth-migration.test.ts
- apps/web/src/app/(app)/w/[slug]/settings/api-keys/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/api-keys/api-keys-settings.tsx
- apps/web/src/app/(app)/w/[slug]/settings/api-keys/actions.ts
- apps/web/src/app/(app)/layout.tsx
- apps/web/src/lib/api-server.ts
- e2e/api-key-management.spec.ts
- e2e/fixtures/session.ts

### Change Log

- 2026-07-20: E4-S5 workspace API key management — schema, service, middleware, REST, UI, tests.
