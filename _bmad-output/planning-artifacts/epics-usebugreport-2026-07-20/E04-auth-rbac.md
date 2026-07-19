# Epic E4: Auth, RBAC & Tier Enforcement

**Goal:** GitHub OAuth, mandatory onboarding gate, workspace/project CRUD, project RBAC, API keys, and AD-11 tier limits at service boundary (LG-3, LG-8).

**FRs:** FR-8, FR-9, FR-22, FR-23 | **ADs:** AD-3, AD-11

**Epic acceptance criteria:**
- Tier enforcement in `UsageService.checkTierLimit()` — not UI-only (board mandate)
- Free: 1 workspace, 30 reports/mo, 1 integration, MCP read-only
- Pro: 5 workspaces, 2k fair-use, webhooks Pro+

---

## Story E4-S1: better-auth GitHub OAuth and session

As a user,
I want to sign in with GitHub and use session or bearer tokens,
So that humans and automation share one auth stack (FR-8, FR-23).

**Acceptance Criteria:**

**Given** `/login`
**When** user completes GitHub OAuth
**Then** better-auth handler at `/api/auth/*` creates session cookie (FR-8)
**And** bearer plugin accepts non-cookie clients for CI/agents (FR-23)

**Given** expired or revoked session
**When** protected route accessed
**Then** HTTP 401 `UNAUTHORIZED`

**Technical notes:** `apps/api` better-auth config with organization, apiKey, bearer plugins. Env: `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. No email/password (PRD A-1).

**Dependencies:** E1-S1.

---

## Story E4-S2: Onboarding gate middleware

As the platform,
I want users with zero workspace memberships redirected to onboarding,
So that no workspace-scoped route renders without tenancy (FR-8 hard gate).

**Acceptance Criteria:**

**Given** authenticated user with zero org memberships
**When** requesting `/w/[slug]/*`, `/settings/account`, or `/settings/workspaces`
**Then** `apps/web` middleware and `apps/api/src/middleware/onboarding-gate.ts` return HTTP 302 to `/onboarding` (architecture §6, EXPERIENCE.md)

**Given** user with ≥1 membership
**When** accessing workspace routes
**Then** gate passes; active org from session `setActive` (FR-8)

**Given** Playwright test
**When** OAuth mock yields zero orgs
**Then** all authenticated paths redirect to onboarding except allowlist (architecture §13 item 1)

**Technical notes:** Multi-tenancy via better-auth Organization plugin only — no Teams feature (PRD FR-8).

**Dependencies:** E4-S1.

---

## Story E4-S3: Workspace and project CRUD with ingest keys

As a workspace admin,
I want to create workspaces, projects, and rotatable ingest keys,
So that each client app has isolated capture credentials (FR-8).

**Acceptance Criteria:**

**Given** admin on `/w/[slug]/settings/projects` or onboarding
**When** creating project
**Then** row inserted in `projects` with `organization_id` scope (AD-3)
**And** ingest key generated with prefix `ubr_ingest_*`, stored hashed in `ingest_keys.key_hash`, shown once (FR-8)

**Given** key rotation
**When** admin rotates ingest key
**Then** old key rejected immediately on presign (HTTP 401) (FR-8)

**Given** Free tier user already owning 1 workspace
**When** creating second workspace via `/settings/workspaces`
**Then** `UsageService.checkTierLimit('workspaces')` returns HTTP 403 or 422 with upgrade message — **service boundary**, not UI-only (AD-11, PRD §9)

**Given** Pro tier user with 5 workspaces
**When** creating sixth
**Then** same tier rejection at service layer

**Technical notes:** Tables `organizations`, `projects`, `ingest_keys`. External IDs `org_*`, `prj_*`. Studio/Agency tier enum values exist in schema but not sellable — stub only (PRD §9).

**Dependencies:** E4-S1, E4-S6 (tier check — implement stub constants in E4-S6 if parallelized).

---

## Story E4-S4: Project-level RBAC

As a workspace admin,
I want viewer/reporter/developer/admin roles per project,
So that report access and actions follow least privilege (FR-9).

**Acceptance Criteria:**

**Given** `project_members` row with role `viewer`
**When** user accesses report list/detail
**Then** read allowed; submit, push, integrations denied at service layer (FR-9)

**Given** role `reporter`
**When** SDK submit or web comment create attempted
**Then** allowed for assigned projects

**Given** role `developer`
**When** Linear push or integration settings accessed
**Then** allowed (FR-9)

**Given** role `admin`
**When** delete report or manage project members
**Then** allowed (FR-9)

**Given** workspace API key with scopes
**When** REST/MCP called
**Then** same boundaries enforced via `AuthContext.projectIds` (FR-9, AD-3)

**Technical notes:** Table `project_members`. Org owner/admin bypass read per architecture §3.1. Integration tests per role (architecture §18 FR-9).

**Dependencies:** E4-S3.

---

## Story E4-S5: Workspace API key management

As a workspace admin,
I want to create, rotate, and revoke API keys with scopes,
So that agents authenticate without embedding secrets in browsers (FR-22).

**Acceptance Criteria:**

**Given** `/w/[slug]/settings/api-keys`
**When** admin creates key
**Then** full `ubr_live_*` shown once; stored hashed in `workspace_api_keys`; prefix + scopes + last_used displayed in list (FR-22)

**Given** scopes checkboxes
**When** key created
**Then** available scopes: `reports:read`, `reports:write`, `mcp:tools`, `webhooks:manage` (FR-22)

**Given** each API request with valid key
**When** middleware validates
**Then** `last_used_at` updated (FR-23)

**Given** revoked key
**When** used on `/api/v1` or `/mcp`
**Then** HTTP 401 (FR-23)

**Technical notes:** better-auth apiKey plugin + `workspace_api_keys` table. UI Modal with CopyButton (EXPERIENCE.md).

**Dependencies:** E4-S1, E4-S4.

---

## Story E4-S6: UsageService tier limits at service boundary (AD-11)

As the platform,
I want all tier limits enforced in UsageService at service entry,
So that API/MCP cannot bypass UI gates (AD-11 board mandate).

**Acceptance Criteria:**

**Given** `UsageService.checkTierLimit(ctx, limitType)` in `packages/services/src/usage.ts`
**When** called at entry of: workspace create, integration connect, webhook register, MCP write operations, ingest (quota)
**Then** limits match PRD §9:

| Limit | Free | Pro |
| --- | --- | --- |
| Workspaces/user | 1 | 5 |
| Reports/mo/workspace | 30 hard | 2000 fair-use |
| Integrations/workspace | 1 | unlimited |
| Webhooks | denied | allowed |
| MCP write (`reports:write`) | denied (read-only) | allowed |

**Given** Free tier API key with `reports:write` scope checkbox
**When** MCP/REST write attempted (post E10) or status mutation via API
**Then** HTTP 403 `FORBIDDEN` at service layer regardless of scope checkbox (AD-11, FR-14)

**Given** Studio/Agency tier in `organizations.billing_tier`
**When** limit checked at v1
**Then** stub constants documented in `packages/config/tiers.ts` — not sellable, no checkout (PRD §9)

**Given** unit tests
**When** `bun test packages/services/src/usage.test.ts`
**Then** each limit type covered for Free vs Pro fixtures

**Technical notes:** Called from `IntegrationService.connect*`, `WebhookService.register`, ingest path (E2-S6), workspace create (E4-S3). Epic acceptance criterion: **not UI-only**.

**Dependencies:** E4-S3, E2-S1 (`workspace_usage_monthly`).
