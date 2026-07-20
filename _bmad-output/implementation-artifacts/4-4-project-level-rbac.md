---
baseline_commit: ddef890
depends_on:
  - 4-3-workspace-and-project-crud-with-ingest-keys
blocks:
  - 4-5-workspace-api-key-management
  - 3-8-human-web-comments-fr-26-lg-2
  - 7-1-linear-oauth-and-integrationservice-config
  - 2-5-reportservice-metadata-reads-and-replay-manifest
---

# Story 4.4: Project-level RBAC

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a workspace admin,
I want viewer/reporter/developer/admin roles per project,
so that report access and actions follow least privilege (FR-9, LG-3).

## Acceptance Criteria

1. **Given** migration `0004_*` applied, **when** schema is inspected, **then** table `project_members` exists per architecture §3.1 with columns `project_id` (FK → `projects.id`), `user_id` (FK → `user.id`), `role` enum (`viewer`, `reporter`, `developer`, `admin`), composite PK `(project_id, user_id)`; **and** index `project_members_user_id_idx` on `user_id` for AuthContext resolution; **and** `projectRoleEnum` exported from `packages/db/src/schema/projects.ts`.

2. **Given** `ProjectService.createProject` completes, **when** the creating user is an org member, **then** a `project_members` row is inserted with role `admin` for that user on the new project (bootstrap — no orphan projects without an admin).

3. **Given** `RBACService` in `packages/services/src/rbac.ts`, **when** `resolveProjectRole(ctx, projectId)` runs, **then** it returns the user's project role from `project_members`, **or** `{ effectiveRole: 'viewer', source: 'org_bypass' }` when org `member.role` is `owner` or `admin` and no project row exists (read bypass per architecture §3.1); **and** returns `null` when user is org member but has no project row and is not org owner/admin.

4. **Given** role hierarchy `viewer < reporter < developer < admin`, **when** `requireProjectRole(ctx, projectId, minRole)` is called, **then** it throws `ServiceError('FORBIDDEN')` when effective role is below minimum; **and** org owner/admin satisfy `minRole: 'admin'` for project-scoped **administration** actions (member CRUD, ingest key rotate, project delete) but **not** for future report mutations unless explicitly documented below.

5. **Given** `project_members` row with role `viewer`, **when** user calls `GET /api/v1/projects/:projectId`, **then** **200** with project payload; **when** user calls `POST /api/v1/projects/:projectId/ingest-keys/rotate`, `PATCH`, or `DELETE` on the same project, **then** HTTP **403** `FORBIDDEN` at service layer (FR-9).

6. **Given** role `reporter`, **when** user reads project detail, **then** allowed; **when** user attempts ingest key rotate or project delete, **then** **403**; **and** `RBACService.canPerform(ctx, projectId, 'ingest:submit')` returns **true** (SDK submit gate — wired for E2-S2 handoff, unit-tested now).

7. **Given** role `developer`, **when** `RBACService.canPerform(ctx, projectId, 'integration:manage')` or `'linear:push'`, **then** returns **true**; **when** `canPerform(..., 'report:delete')` or `'project:manage_members'`, **then** returns **false** unless role is `admin`.

8. **Given** role `admin` on a project, **when** user calls `POST /api/v1/projects/:projectId/members`, `PATCH .../members/:userId`, or `DELETE .../members/:userId`, **then** member CRUD succeeds; **when** user deletes project or rotates ingest key, **then** allowed (FR-9 admin capabilities).

9. **Given** extended `AuthContext` per AD-3, **when** session middleware resolves context, **then** shape includes `{ type: 'session', userId, organizationId, orgRole?, projectIds? }`; **and** `projectIds` lists project IDs where user has any `project_members` row in the active org (for future API-key scoping in E4-S5); **and** org role resolved from better-auth `member` table.

10. **Given** org admin without explicit project membership, **when** listing projects via `GET /api/v1/workspaces/:organizationId/projects`, **then** all org projects returned (read bypass); **when** non-member non-admin org user lists projects, **then** only projects where they have a `project_members` row.

11. **Given** `/w/[slug]/projects/[id]` per EXPERIENCE.md, **when** project admin visits, **then** Members section renders `Table` of project members with `Select` role picker and remove action; **and** `Modal` to add org member (dropdown of org members not yet on project); **and** ingest key rotate / delete project buttons visible only when effective role ≥ admin (or org admin); **and** viewer sees read-only detail without admin actions (UI hides/disables — no permission-denied page).

12. **Given** `/w/[slug]/settings/members` (deferred from E4-S3), **when** org admin visits, **then** page lists org members (`Table`: name, email, org role) with invite `Modal` (email + org role `Select`: `member`/`admin` only — not `owner`); **and** uses better-auth organization invite API; **and** does **not** assign project roles here (project roles assigned on project detail only).

13. **Given** `bun test packages/services/src/rbac.test.ts`, **when** run, **then** role matrix covers all four roles × actions: `project:read`, `ingest:submit`, `integration:manage`, `linear:push`, `report:delete`, `project:manage_members`, `ingest:rotate`, `project:delete`; **and** org owner/admin read bypass and admin-override cases included.

14. **Given** API integration tests `apps/api/src/__tests__/project-rbac.integration.test.ts`, **when** run with Docker Postgres, **then** fixtures seed org + two projects + users at each role; **and** verify **403** paths for viewer/reporter on mutate routes and **200** on permitted reads; **and** cross-org project member access → **404** or **403** (AD-3).

15. **Given** Playwright `e2e/project-rbac.spec.ts` with session fixtures, **when** admin assigns viewer role to second user and switches session, **then** rotate/delete controls hidden; **when** admin promotes to reporter, **then** still no rotate; **when** admin promotes to admin, **then** member management visible.

16. **Out of scope for this story:** `workspace_api_keys` / `ubr_live_*` scope enforcement (E4-S5 — only extend `AuthContext.projectIds` now); `ReportService` / report list/detail routes (E2-S5/E3 — export `canPerform` helpers only); Linear OAuth (E7); MCP/REST surface registry (E6); presign/complete ingest routes (E2-S2 — consume `ingest:submit` check when wired); invite **accept** e2e with real email (better-auth default callback OK; full accept-flow Playwright optional stub); GDPR delete (E9).

## Tasks / Subtasks

- [x] Task 1 — Schema migration `0004` (AC: 1)
  - [x] Add `projectRoleEnum` + `projectMembers` table to `packages/db/src/schema/projects.ts` with relations to `projects` and `user`
  - [x] Generate `packages/db/migrations/0004_project_members.sql`; export from `schema/index.ts`
  - [x] Migration test `packages/db/src/__tests__/project-members-migration.test.ts` (skip without `DATABASE_URL`)

- [x] Task 2 — RBACService + AuthContext extension (AC: 3, 4, 6, 7, 9, 13)
  - [x] Extend `packages/services/src/types.ts` — `AuthContext` adds optional `orgRole?: 'owner' | 'admin' | 'member'`, `projectIds?: string[]`, `apiKeyId?: string` (stub for E4-S5)
  - [x] Add `ProjectRole` type and `PROJECT_ROLE_ORDER` constant; `ProjectAction` union for capability checks
  - [x] Implement `packages/services/src/rbac.ts` — `createRBACService(db)` with `resolveProjectRole`, `requireProjectRole`, `canPerform`, `listAccessibleProjectIds`
  - [x] Export from `packages/services/src/index.ts`
  - [x] Unit tests `packages/services/src/rbac.test.ts` — full role matrix + org bypass

- [x] Task 3 — ProjectService + member CRUD (AC: 2, 5–8, 10)
  - [x] Update `ProjectService.createProject` — insert creator as `project_members` admin in same transaction
  - [x] Update `listProjects` — filter by accessible project IDs unless org owner/admin (see AC 10)
  - [x] Add `listProjectMembers`, `addProjectMember`, `updateProjectMemberRole`, `removeProjectMember` — all require `requireProjectRole(..., 'admin')` or org admin
  - [x] Replace raw `requireOrgAdmin` on rotate/delete/patch with `requireProjectRole(..., 'admin')` **or** org admin (ingest rotate, project update/delete)
  - [x] Unit tests extend `project.test.ts` for member CRUD + list filtering

- [x] Task 4 — API routes + middleware (AC: 5–10, 14)
  - [x] Create `apps/api/src/middleware/auth-context.ts` — resolve session → `AuthContext` with `orgRole` + `projectIds` (or extend `session.ts` if cleaner)
  - [x] Create `apps/api/src/routes/project-members.ts` — GET/POST/PATCH/DELETE under `/api/v1/projects/:projectId/members`
  - [x] Update `apps/api/src/routes/projects.ts` — RBAC on existing handlers; inject `RBACService`
  - [x] Update `apps/api/src/routes/workspaces.ts` — project list uses filtered `listProjects`
  - [x] Wire routes in `apps/api/src/index.ts`
  - [x] Integration tests `apps/api/src/__tests__/project-rbac.integration.test.ts` — multi-user fixtures via direct DB seed (pattern from `workspace-project.integration.test.ts`)

- [x] Task 5 — Web UI (AC: 11, 12)
  - [x] Replace placeholder in `apps/web/src/app/(app)/w/[slug]/projects/[id]/project-detail.tsx` — Members `Table`, add-member `Modal`, role `Select`, conditional admin actions via client-side role prop from server
  - [x] Add server loader/API calls in `page.tsx` + client actions for member CRUD
  - [x] Create `apps/web/src/app/(app)/w/[slug]/settings/members/page.tsx` + client component — org member list + invite modal (better-auth `authClient.organization.inviteMember`)
  - [x] Gate `/w/[slug]/settings/members` to org admin (server redirect or 403 Alert)
  - [x] Hide nav link to settings/members for non-admins (EXPERIENCE.md — no permission-denied pages for hidden nav)

- [x] Task 6 — Playwright + verification (AC: 13–15, DoD)
  - [x] `e2e/project-rbac.spec.ts` — extend `e2e/fixtures/session.ts` for multi-user sessions if needed
  - [x] Run full verification commands in Testing Requirements

## Dev Notes

### Goal

Queue position **#7** in sprint plan — **E4-S3 (projects + ingest keys) is done**. Delivers FR-9 / LG-3 project-level RBAC: `project_members` schema, `RBACService` with deny-by-default capability checks, route enforcement in `apps/api`, project member + org member management UI, and tests. Unblocks E4-S5 (API keys need `AuthContext.projectIds`), E3-S8 (comment composer gated on reporter+), E7-S1 (integration settings need developer+), E2-S5 (report reads use viewer+ check).

### Scope boundary (critical)

| In E4-S4 | Deferred |
| --- | --- |
| `project_members` migration `0004` + enum | `workspace_api_keys` table enforcement (E4-S5) |
| `RBACService` role matrix + `canPerform` helpers | `ReportService` routes (E2-S5/E3-S4/S7) |
| Extend `AuthContext` (`orgRole`, `projectIds`) | MCP/REST auth middleware for API keys (E4-S5/E5) |
| Project member CRUD API + project detail UI | Presign/inline ingest wiring (E2-S2 uses `ingest:submit`) |
| Org member list + invite at `/settings/members` | Full invite-accept Playwright with email (optional stub) |
| Re-scope project mutate routes (rotate/delete/patch) | Linear default team UI (developer+ — stub Select OK) |
| bun unit role matrix + API integration 403 paths | Org-level role changes beyond invite (owner transfer — v2) |
| Playwright role assignment flow | Comment thread RBAC UI (E3-S8) |

**Org vs project roles (do not conflate):**

| Layer | Storage | Values | Scope |
| --- | --- | --- | --- |
| Org | better-auth `member.role` | `owner`, `admin`, `member` | Workspace membership, settings/API keys (org admin), billing |
| Project | `project_members.role` | `viewer`, `reporter`, `developer`, `admin` | Report access, SDK submit, integrations, project admin |

**Org invite (E4-S3 carryover):** FR-8 mentions workspace invites. E4-S3 explicitly deferred org invite UI to this story. Implement **list + invite** at `/w/[slug]/settings/members` using better-auth organization plugin (`invitation` table already migrated in `0001`). Project role assignment happens only on `/w/[slug]/projects/[id]` — invited org members default to **no project access** until explicitly added.

### Current repo state (modify / extend)

| Path | Current state | This story changes |
| --- | --- | --- |
| `packages/db/src/schema/projects.ts` | `projects`, `ingest_keys`, `user_preferences` | Add `projectRoleEnum`, `projectMembers` |
| `packages/services/src/types.ts` | `AuthContext` session-only | Add `orgRole`, `projectIds`, `apiKeyId?` |
| `packages/services/src/project.ts` | Org-admin gate on mutate; no members | RBAC gates; member CRUD; creator bootstrap |
| `packages/services/src/workspace.ts` | `requireOrgAdmin` / `requireOrgMember` | Keep for org-scoped ops; project ops use RBAC |
| `apps/api/src/routes/projects.ts` | `requireOrgAdmin` on PATCH/DELETE/rotate | `requireProjectRole(..., 'admin')` or org admin |
| `apps/api/src/routes/workspaces.ts` | Project list unfiltered for org member | Filter via RBAC accessible IDs |
| `apps/web/.../project-detail.tsx` | Placeholder "RBAC in E4-S4" | Full members section + gated actions |
| `apps/web/.../settings/members/` | **Missing** | New org members page |
| `apps/api/src/middleware/session.ts` | Session user only | Extend or add `auth-context.ts` for orgRole/projectIds |

**Do not touch:** capture packages, worker, UsageService tier logic, Stripe, `_bmad-output/` (except this story + sprint-status), ingest schema beyond FK references.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| AD-3 | `AuthContext` first arg on all service methods; `{ type, organizationId, userId, orgRole?, projectIds?, apiKeyId? }`; project reads check `project_members` unless org owner/admin bypass |
| §3.1 | `project_members` PK `(project_id, user_id)`; enum exactly four values |
| §6 RBAC table | Report read ≥ viewer; status/comment ≥ reporter; Linear push ≥ developer; report delete ≥ admin; settings/API keys ≥ org admin |
| §12 | Error envelope `{ error: { code, message, requestId } }` — **403** `FORBIDDEN` for RBAC denial |
| §13 / FR-9 | Integration tests per role; bun unit role matrix |
| EXPERIENCE.md | Project detail Members `Table` + invite `Modal` + role `Select`; settings/members org invite; UI hides unauthorized actions |
| PRD FR-9 | Four roles with cumulative permissions; API key boundaries deferred to E4-S5 but `projectIds` on context now |

### RBAC role matrix (implement exactly)

| Action key | viewer | reporter | developer | admin | org owner/admin (no row) |
| --- | ---: | ---: | ---: | ---: | --- |
| `project:read` | ✓ | ✓ | ✓ | ✓ | ✓ (read bypass) |
| `ingest:submit` | ✗ | ✓ | ✓ | ✓ | ✗ (no bypass — must be project member) |
| `integration:manage` | ✗ | ✗ | ✓ | ✓ | ✗ |
| `linear:push` | ✗ | ✗ | ✓ | ✓ | ✗ |
| `report:delete` | ✗ | ✗ | ✗ | ✓ | ✗ |
| `project:manage_members` | ✗ | ✗ | ✗ | ✓ | ✓ (org admin override) |
| `ingest:rotate` | ✗ | ✗ | ✗ | ✓ | ✓ (org admin override) |
| `project:delete` | ✗ | ✗ | ✗ | ✓ | ✓ (org admin override) |
| `project:update` | ✗ | ✗ | ✗ | ✓ | ✓ (org admin override) |

**Deny-by-default:** If no `project_members` row and not org owner/admin read bypass → treat as **no access** (403/404). Never infer reporter from org `member` role alone.

### AuthContext resolution (AD-3)

```typescript
export type OrgRole = "owner" | "admin" | "member";
export type ProjectRole = "viewer" | "reporter" | "developer" | "admin";

export interface AuthContext {
  type: "session"; // E4-S5 adds "api_key"
  userId: string;
  organizationId: string;
  orgRole?: OrgRole;
  projectIds?: string[]; // all project IDs with membership in active org
  apiKeyId?: string;
  requestId?: string;
}
```

Middleware flow:

```text
requireSession → activeOrganizationId
  → load member.role for (userId, organizationId) → orgRole
  → load projectIds from project_members JOIN projects WHERE organization_id = orgId
  → attach AuthContext to handler
```

For E4-S5 handoff: API key middleware will populate `type: 'api_key'`, `projectIds` from key scopes/metadata — **do not implement key auth here**, only extend the type.

### RBACService API sketch

```typescript
export function createRBACService(db: DbClient) {
  return {
    resolveProjectRole(ctx: AuthContext, projectId: string): Promise<{
      role: ProjectRole | null;
      source: "membership" | "org_bypass_read" | "none";
    }>,
    requireProjectRole(ctx: AuthContext, projectId: string, minRole: ProjectRole): Promise<ProjectRole>,
    canPerform(ctx: AuthContext, projectId: string, action: ProjectAction): Promise<boolean>,
    listAccessibleProjectIds(ctx: AuthContext): Promise<string[] | "all">, // "all" for org owner/admin
  };
}
```

Org admin override for **administration** actions (`project:manage_members`, `ingest:rotate`, `project:delete`, `project:update`): allow when `orgRole` is `owner` or `admin` even without `project_members` row.

### Project create bootstrap

In `ProjectService.createProject` transaction, after `INSERT projects`:

```text
INSERT project_members (project_id, user_id, role) VALUES (newProjectId, ctx.userId, 'admin')
```

Onboarding first project: creator already org owner → gets both org owner + project admin row.

### REST route sketch (new + updated)

| Method | Path | Min role | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/projects/:projectId/members` | `admin` or org admin | List members with user name/email join |
| POST | `/api/v1/projects/:projectId/members` | `admin` | Body `{ userId, role }` — user must be org member |
| PATCH | `/api/v1/projects/:projectId/members/:userId` | `admin` | Body `{ role }` — cannot demote last admin |
| DELETE | `/api/v1/projects/:projectId/members/:userId` | `admin` | Cannot remove last admin |
| GET | `/api/v1/projects/:projectId` | `project:read` | Was org member — tighten |
| PATCH/DELETE/rotate | `/api/v1/projects/:projectId/*` | `admin` (+ org admin override) | Replace bare `requireOrgAdmin` |
| GET | `/api/v1/workspaces/:organizationId/projects` | org member | Filtered list per AC 10 |

### UX surfaces (Mantine)

| Route | Components | RBAC UX |
| --- | --- | --- |
| `/w/[slug]/projects/[id]` | `Table`, `Modal`, `Select`, `Button` | Admin: members CRUD + rotate/delete; viewer: read-only, buttons hidden |
| `/w/[slug]/settings/members` | `Table`, invite `Modal`, org role `Select` | Org admin only; link hidden for others |
| Project list actions | Edit/Delete | Visible only when project admin or org admin |

Server should pass `effectiveRole` or `capabilities` object to client to drive visibility — avoid client-side role guessing.

### Previous story intelligence

**E4-S3 (`4-3-workspace-and-project-crud-with-ingest-keys.md`):**

- Explicitly **did not** create `project_members`; placeholder in `project-detail.tsx` line 74
- All project mutations use `requireOrgAdmin` — **must refactor** to project RBAC
- Integration test pattern: direct DB seed + signed cookie fixture in `workspace-project.integration.test.ts`
- Playwright: serial workers when `CI=1`; extend `e2e/fixtures/session.ts`
- `generatePrefixedId`, `ServiceError`, cursor pagination patterns established

**E4-S1 (`4-1-better-auth-github-oauth-and-session.md`):**

- Organization plugin with `member`, `invitation` tables; org roles `owner`/`admin`/`member`
- `apps/api/src/middleware/session.ts` exists; full `AuthContext` deferred to this story

**E4-S2 / E4-S6:** Onboarding gate and UsageService unchanged; workspace create path untouched.

**Git (baseline ddef890):** `feat: add workspace and project management with ingest keys` — services/routes/UI patterns to extend, not replace.

### Anti-patterns (do not do)

- Do not store project roles on better-auth `member.role` — project roles live in `project_members` only
- Do not grant reporter/developer via org `member` role — explicit project assignment required
- Do not implement `workspace_api_keys` REST/UI (E4-S5)
- Do not add report routes just to test RBAC — use project routes + `canPerform` unit/integration tests
- Do not show 403 pages for hidden nav — hide/disable per EXPERIENCE.md
- Do not allow removing the last project admin without assigning replacement
- Do not use Radix — Mantine only
- Do not commit secrets or `.env`

### Project structure (new / updated files)

```text
packages/db/src/schema/projects.ts                         # UPDATE — projectMembers + enum
packages/db/migrations/0004_project_members.sql           # NEW
packages/db/src/__tests__/project-members-migration.test.ts # NEW
packages/services/src/rbac.ts                              # NEW
packages/services/src/rbac.test.ts                         # NEW
packages/services/src/types.ts                             # UPDATE — AuthContext
packages/services/src/project.ts                          # UPDATE — RBAC + members
packages/services/src/project.test.ts                     # UPDATE
packages/services/src/index.ts                            # UPDATE — exports
apps/api/src/middleware/auth-context.ts                   # NEW (or extend session.ts)
apps/api/src/routes/project-members.ts                    # NEW
apps/api/src/routes/projects.ts                           # UPDATE — RBAC gates
apps/api/src/routes/workspaces.ts                         # UPDATE — filtered list
apps/api/src/__tests__/project-rbac.integration.test.ts   # NEW
apps/api/src/index.ts                                     # UPDATE — wire routes
apps/web/src/app/(app)/w/[slug]/projects/[id]/project-detail.tsx  # UPDATE
apps/web/src/app/(app)/w/[slug]/projects/[id]/page.tsx    # UPDATE — load members + role
apps/web/src/app/(app)/w/[slug]/settings/members/page.tsx # NEW
apps/web/src/app/(app)/w/[slug]/settings/members/members-settings.tsx # NEW
e2e/project-rbac.spec.ts                                  # NEW
```

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E04-auth-rbac.md#Story E4-S4]
- [Source: _bmad-output/planning-artifacts/prds/prd-usebugreport-2026-07-20/prd.md#FR-9]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#3.1 Domain Tables]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#RBAC enforcement points]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/ARCHITECTURE-SPINE.md#AD-3]
- [Source: _bmad-output/planning-artifacts/ux-usebugreport-2026-07-20/EXPERIENCE.md — project detail Members, settings/members]
- [Source: _bmad-output/implementation-artifacts/4-3-workspace-and-project-crud-with-ingest-keys.md]
- [Source: _bmad-output/implementation-artifacts/sprint-plan-2026-07-20.md — position 7]
- [Source: packages/db/src/schema/auth.ts — member, invitation tables]
- [Source: packages/services/src/project.ts — mutate gates to refactor]
- [Source: apps/web/src/app/(app)/w/[slug]/projects/[id]/project-detail.tsx — RBAC placeholder]

## Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
docker compose -f docker/docker-compose.dev.yml up postgres -d

bun install
bun run db:migrate
bunx biome check .
bunx turbo run lint typecheck test build

# RBAC unit matrix
bun test packages/services/src/rbac.test.ts
bun test packages/services/src/project.test.ts

# Schema migration
DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:5432/usebugreport \
  bun test packages/db/src/__tests__/project-members-migration.test.ts

# API integration — multi-role 403 paths
DATABASE_URL=postgresql://usebugreport:usebugreport@localhost:5432/usebugreport \
  bun test apps/api/src/__tests__/project-rbac.integration.test.ts

# Playwright role assignment
bunx playwright test e2e/project-rbac.spec.ts
```

**Required integration coverage:**

| Case | Expected |
| --- | --- |
| Viewer GET project | 200 |
| Viewer POST rotate ingest key | 403 `FORBIDDEN` |
| Reporter GET project | 200 |
| Reporter DELETE project | 403 |
| Developer GET project | 200 |
| Developer add project member | 403 |
| Admin add/update/remove member | 200/204 |
| Admin rotate + delete project | 200 |
| Org admin without project row GET project | 200 (read bypass) |
| Org admin rotate without membership | 200 (admin override) |
| Org member without project row GET project | 403 or 404 |
| Add member not in org | 422 |
| Remove last project admin | 409 or 422 |
| Cross-org member list | 404 |

**Required Playwright coverage (AC15):**

| Step | Expected |
| --- | --- |
| Admin opens project detail → Members | Table visible |
| Admin adds org member as viewer | Row appears |
| Switch to viewer session | Rotate/delete hidden |
| Admin promotes to admin | Member management + rotate visible |

## Definition of Done

- [x] All acceptance criteria met
- [x] Migration `0004` applied cleanly after `0000`–`0003`
- [x] `RBACService` role matrix unit-tested
- [x] Project routes enforce deny-by-default RBAC
- [x] Project detail + settings/members UI per EXPERIENCE.md
- [x] `AuthContext` extended for E4-S5 handoff
- [x] `turbo lint typecheck test build` exit 0
- [x] Playwright `project-rbac.spec.ts` passes
- [x] Story status moved to `review` by dev agent; code-review marks `done`

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast (subagent)

### Debug Log References

- integration tests returned 500 until `@usebugreport/services` dist rebuild picked up RBAC changes
- e2e add-member modal needed Mantine `[role='option']` selector + page reload after server action

### Completion Notes List

- migration `0004_project_members` adds `project_role` enum + `project_members` with composite PK and user index
- `RBACService` implements deny-by-default matrix with org owner/admin read bypass and admin overrides for project administration actions
- `ProjectService` bootstraps creator as project admin, filters project lists, and exposes member CRUD with last-admin guards
- API resolves full `AuthContext` (orgRole, projectIds) via `auth-context.ts`; new member routes + RBAC gates on project mutations
- Web: project detail members table + gated actions; org members page at `/w/[slug]/settings/members` with invite modal; nav hidden for non-admins
- verification: `bunx turbo run lint typecheck build test` (44/44), migration + RBAC integration tests, `CI=1 bunx playwright test` (8 passed, 1 skipped)

### File List

- packages/db/src/schema/projects.ts
- packages/db/src/index.ts
- packages/db/migrations/0004_project_members.sql
- packages/db/migrations/meta/_journal.json
- packages/db/src/__tests__/project-members-migration.test.ts
- packages/services/src/types.ts
- packages/services/src/rbac.ts
- packages/services/src/rbac.test.ts
- packages/services/src/project.ts
- packages/services/src/project.test.ts
- packages/services/src/index.ts
- apps/api/src/middleware/auth-context.ts
- apps/api/src/routes/project-members.ts
- apps/api/src/routes/projects.ts
- apps/api/src/routes/workspaces.ts
- apps/api/src/index.ts
- apps/api/src/routes/workspaces.ts (review fix: org-admin gate on members list)
- apps/api/src/__tests__/project-rbac.integration.test.ts (review: workspace members ACL tests)
- apps/api/src/__tests__/workspace-project.integration.test.ts
- apps/web/src/lib/api-server.ts
- apps/web/src/app/(app)/layout.tsx
- apps/web/src/app/(app)/w/[slug]/projects/[id]/actions.ts
- apps/web/src/app/(app)/w/[slug]/projects/[id]/project-detail.tsx
- apps/web/src/app/(app)/w/[slug]/projects/[id]/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/members/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/members/members-settings.tsx
- e2e/fixtures/session.ts
- e2e/fixtures/project-rbac.ts
- e2e/project-rbac.spec.ts

## Senior Developer Review (AI)

**Reviewer:** Composer (headless code-review)  
**Date:** 2026-07-20  
**Verdict:** **Approved** (after fix)

### Summary

Implementation matches FR-9 deny-by-default matrix, AD-3 tenant scoping, and story ACs. One HIGH privilege-escalation finding on workspace members API was fixed in review.

### Findings

| Severity | Finding | Action |
| --- | --- | --- |
| **HIGH** | `GET /api/v1/workspaces/:organizationId/members` used `requireOrgMember` — any org member could enumerate member emails | **Fixed:** gate with `requireOrgAdmin`; integration tests added |
| MEDIUM | `loadMembership` / some member CRUD lookups omit `projects.organization_id` join | Accepted — preceded by `assertProjectInOrg` / `requireProjectRole` |
| LOW | Cross-org workspace members returns **403** (not 404) via `requireOrgAdmin` | Accepted — still blocks cross-tenant access |

### Privilege-escalation audit

| Attack | Result |
| --- | --- |
| Viewer/reporter mutates project members | **403** — `requireProjectRole(..., 'admin')` |
| Project admin of A administers B | **403** — no membership / override on B |
| Org member without project row reads project | **403** |
| Org member lists workspace member emails | **403** (after fix) |
| Cross-org project member list | **403/404** |
| Self-elevate role without admin | **403** |
| Remove/demote last project admin | **409 CONFLICT** |
| Org admin override rotate/read without membership | **200** (intentional per AC) |

### Verification

- `bunx turbo run lint typecheck build test` — 44/44 tasks pass
- `DATABASE_URL=… bun test` — migration (3), rbac (8), project (5), api integration (13+6) — all pass
- `CI=1 bunx playwright test` — 8 passed, 1 skipped

## Change Log

- 2026-07-20: Story 4.4 drafted — project RBAC, project_members schema, RBACService, member UI, org invite carryover from E4-S3
- 2026-07-20: Implemented project-level RBAC end-to-end — schema, services, API, UI, tests; status → review
- 2026-07-20: Code review approved — fixed workspace members API org-admin gate; status → done
