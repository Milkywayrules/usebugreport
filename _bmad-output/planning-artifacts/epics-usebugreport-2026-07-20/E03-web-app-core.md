# Epic E3: Web App Core

**Goal:** Keyboard-first triage web app with replay viewer, human comments, bulk actions, ⌘K palette, workspace switcher (LG-2, LG-3, LG-9).

**FRs:** FR-6, FR-8 (UI surfaces), FR-11, FR-12, FR-13, FR-26 | **ADs:** AD-10, AD-11 (UI reflects service errors)

**Epic acceptance criteria:**
- Mantine v7 + Next.js 15 App Router; **no Radix UI**
- `POST /api/web/reports/:id/comments` → `CommentService.create` (FR-26, LG-2)
- Bulk status change and bulk Linear push on report list (FR-11)
- Keyboard registry single source in `apps/web/src/keyboard/shortcuts.ts` (AD-10)

---

## Story E3-S1: Web app shell, theme, and route scaffold

As an authenticated member,
I want the AppShell with workspace-scoped routes per EXPERIENCE.md,
So that I can navigate reports, projects, and settings (FR-8 UI, LG-3).

**Acceptance Criteria:**

**Given** Next.js App Router under `apps/web/src/app/`
**When** routes compile
**Then** paths exist: `(auth)/login`, `(auth)/auth/callback`, `(app)/onboarding`, `(app)/w/[slug]/reports`, `(app)/w/[slug]/settings/**`, `(app)/settings/account`, `(app)/r/[id]` redirect (EXPERIENCE.md route map)

**Given** root layout
**When** app loads
**Then** Mantine v7 `MantineProvider`, `ModalsProvider`, `Notifications`, dark default via `ColorSchemeScript` (EXPERIENCE.md theming)
**And** ESLint `no-restricted-imports` blocks `@radix-ui/*`

**Given** middleware for authenticated users with zero org memberships
**When** any authenticated route except `/onboarding`, `/login`, `/auth/callback` is requested
**Then** HTTP 302 to `/onboarding` (FR-8 hard gate, EXPERIENCE.md)

**Technical notes:** `apps/web/src/theme/theme.ts` from DESIGN.md tokens. TanStack Query provider. Same-origin API calls with session cookie.

**Dependencies:** E4-S1 (auth session).

---

## Story E3-S2: Onboarding wizard

As a new user with no workspace,
I want a stepper to create my first workspace and project,
So that I satisfy the membership gate and get an SDK snippet (FR-8, UJ-5).

**Acceptance Criteria:**

**Given** user on `/onboarding` with zero memberships
**When** step 1 completes (workspace + first project + ingest key)
**Then** organization and project created via better-auth org APIs
**And** "Skip to dashboard" remains disabled until step 1 completes (EXPERIENCE.md)

**Given** step 2
**When** user views SDK snippet
**Then** `@usebugreport/browser` init code shows pre-filled `projectKey` with CopyButton

**Given** step 3
**When** polling list every 5s detects first report
**Then** redirect to `/w/[slug]/reports/[id]` (EXPERIENCE.md Flow 5)

**Technical notes:** `(app)/onboarding/page.tsx` with Mantine `Stepper`. Playwright: LG gate onboarding hard gate (architecture §13).

**Dependencies:** E3-S1, E4-S3.

---

## Story E3-S3: Workspace switcher and pinned workspaces

As a user in multiple workspaces,
I want to switch active workspace in ≤2 keystrokes,
So that triage stays scoped to the right client (FR-13).

**Acceptance Criteria:**

**Given** user configured pins on `/settings/workspaces`
**When** user presses ⌘1–⌘9 (Ctrl on Windows/Linux)
**Then** active workspace switches to pinned slot without opening menu (FR-13)
**And** TanStack Query cache invalidates workspace-scoped queries (EXPERIENCE.md state patterns)

**Given** ⌘K action `ws.switch`
**When** executed
**Then** fuzzy list of all memberships opens in Spotlight sub-palette

**Given** `user_preferences.pinned_workspace_ids` (max 9)
**When** pin order saved
**Then** persisted to Postgres table `user_preferences` (architecture §3.1)

**Technical notes:** Header `WorkspaceSwitcher` Menu component. `authClient.organization.setActive()`. Route `/settings/workspaces` with drag reorder.

**Dependencies:** E3-S1, E4-S1.

---

## Story E3-S4: Dense report list with keyboard navigation

As a triage lead,
I want a filterable report table with j/k/x navigation,
So that I can review queues without a mouse (FR-11, LG-9).

**Acceptance Criteria:**

**Given** `/w/[slug]/reports` with viewer+ role
**When** page loads
**Then** TanStack Table shows columns: checkbox, status, title, project, reporter, age, Linear indicator (EXPERIENCE.md)
**And** filters sync to URL query params: `status`, `project`, `q`, `since` (EXPERIENCE.md)
**And** pagination 50/page with cursor or offset matching API

**Given** list focused (auto-focus on route enter)
**When** user presses j/k, x, Shift+X, Enter, /
**Then** row focus, select toggle, select all visible, open detail, focus search work per EXPERIENCE.md keyboard map (FR-11)

**Given** viewer role
**When** list renders
**Then** status/push shortcuts hidden; read-only (FR-9, EXPERIENCE.md RBAC)

**Technical notes:** `apps/web/src/app/(app)/w/[slug]/reports/page.tsx`. Data from `GET /api/v1/reports` or session-scoped BFF. FCP < 2s p95 (PRD FR-11 NFR). WCAG 2.1 AA grid ARIA per EXPERIENCE.md.

**Dependencies:** E2-S5, E3-S1.

---

## Story E3-S5: Bulk status change

As a triage lead,
I want to change status for multiple selected reports at once,
So that queue hygiene stays fast at agency scale (FR-11 board mandate).

**Acceptance Criteria:**

**Given** one or more reports selected via checkbox or x on focused row
**When** bulk bar visible and user picks status (bulk bar menu, palette `bulk.status`, or keys 1–5)
**Then** `ReportService.updateStatus` called per report (or batch API if added) with optimistic TanStack Query update
**And** failures revert with toast "{n} updated, {m} failed" pattern (EXPERIENCE.md)

**Given** bulk selection persists across filter change
**When** selected IDs still visible in current page
**Then** selection retained (EXPERIENCE.md bulk bar rules)

**Given** Playwright test
**When** bulk status run on 3 fixtures
**Then** all rows reflect new status in list (architecture §13 item 2)

**Technical notes:** Bulk bar `Affix` bottom. Session auth to REST or dedicated web route calling `ReportService`. Enqueues `webhooks.dispatch` `report.updated` per E8.

**Dependencies:** E3-S4, E2-S5.

---

## Story E3-S6: Bulk Linear push

As a triage lead,
I want to push many selected reports to Linear in one action,
So that cross-client staging sweeps stay efficient (FR-11, FR-21, board mandate).

**Acceptance Criteria:**

**Given** selection > 0 and Linear integration configured
**When** user triggers bulk push (bulk bar, `p` key, or palette `bulk.push-linear`)
**Then** confirm modal lists count (EXPERIENCE.md)
**And** parallel mutations call `IntegrationService.pushReportToLinear` per report (E7 outbox)
**And** toast summarizes success/failure counts with expandable failed IDs (EXPERIENCE.md bulk partial failure)

**Given** Linear not configured
**When** push attempted
**Then** button disabled with tooltip "Connect Linear in Settings" (EXPERIENCE.md)

**Given** Playwright test
**When** bulk push on mocked Linear
**Then** Linear URL appears on succeeded reports (architecture §13 item 2)

**Technical notes:** Uses outbox dedupe from E7-S2/S3. Developer+ role required (FR-9).

**Dependencies:** E3-S5, E7-S2.

---

## Story E3-S7: Report detail and replay viewer

As a project member,
I want replay, console, network, and metadata tabs on report detail,
So that I can diagnose bugs in one surface (FR-6, LG-2).

**Acceptance Criteria:**

**Given** `/w/[slug]/reports/[id]` with project access
**When** Replay tab loads
**Then** `ReplayViewer.tsx` fetches manifest via TanStack Query → `ReportService.getReplayManifest`
**And** `rrweb-player` loads events from presigned R2 URLs client-side (AD-6)
**And** play/pause and scrub work; Space and ←→ ±5s when replay focused (EXPERIENCE.md)

**Given** Console and Network tabs
**When** opened
**Then** console filterable by level; network by status code and host (FR-6)
**And** response bodies show redaction consistent with capture (FR-2)

**Given** insufficient project role or cross-org access
**When** detail fetched
**Then** HTTP 403 full-page Alert (EXPERIENCE.md)

**Given** replay past `expires_at`
**When** Replay tab opened
**Then** "Replay expired — {tier} retention is {N} days" message (EXPERIENCE.md state)

**Technical notes:** Gunzip in Web Worker `replay-worker.ts`. Lazy load on tab enter. Playwright LG-2 replay load.

**Dependencies:** E2-S5, E3-S1.

---

## Story E3-S8: Human web comments (FR-26, LG-2)

As a reporter-or-above project member,
I want to view and create comments on a report from the web app,
So that triage notes stay with the report thread (FR-26 — **v1.0 launch gate, not fast-follow**).

**Acceptance Criteria:**

**Given** Comments tab on report detail
**When** page loads
**Then** `GET /api/web/reports/:id/comments` returns thread ordered chronologically with author display name and timestamp (FR-26)
**And** route registered in `apps/api/src/routes/web/comments.ts` calling `CommentService.list` (architecture §5.2)

**Given** reporter+ role
**When** user submits non-empty comment via sticky `Textarea` + submit
**Then** `POST /api/web/reports/:id/comments` invokes `CommentService.create` with session auth (not `/api/v1`, not API key) (architecture §5.2, board mandate)
**And** UI optimistically appends comment; reverts with toast on failure (EXPERIENCE.md)
**And** empty submit disabled

**Given** viewer role
**When** Comments tab renders
**Then** thread read-only; no composer (FR-26)

**Given** Playwright test (architecture §13 item 6)
**When** composer submits comment
**Then** comment persists in Postgres `report_comments` and appears on reload

**Technical notes:** Table `report_comments` (`cmt_*` IDs). Comments included in FR-10 deletion cascade. Agent comments (FR-16) deferred to E10 — no API key attribution UI required at launch.

**Dependencies:** E3-S7, E4-S4 (RBAC). Requires `CommentService` in `packages/services/src/comment.ts` (implement service in this story if not yet present).

---

## Story E3-S9: Command palette (⌘K)

As a power user,
I want ⌘K Spotlight actions for navigation and report operations,
So that triage stays keyboard-centric (FR-12, LG-9).

**Acceptance Criteria:**

**Given** authenticated app shell
**When** user presses ⌘K / Ctrl+K
**Then** `@mantine/spotlight` opens with static actions per EXPERIENCE.md inventory (nav, workspace, report, bulk when selection > 0)

**Given** typing ≥2 chars
**When** search runs
**Then** dynamic providers query `GET /api/v1/reports/search?q=` and client-side projects (EXPERIENCE.md)

**Given** recent commands
**When** palette opens empty
**Then** last 5 action IDs shown from `localStorage` key `ubr_spotlight_recent`

**Given** report context actions (push, copy summary, status changes)
**When** executed from palette
**Then** same mutations as list/detail shortcuts (FR-12)

**Technical notes:** `apps/web/src/keyboard/useRegisterSpotlightActions.ts`. SM-3 metric: track palette invocations (observability optional hook).

**Dependencies:** E3-S4, E3-S10.

---

## Story E3-S10: Central keyboard shortcuts registry

As a developer,
I want one SHORTCUTS map consumed by Spotlight and useHotkeys,
So that keyboard behavior never drifts (AD-10).

**Acceptance Criteria:**

**Given** `apps/web/src/keyboard/shortcuts.ts`
**When** list and detail routes mount
**Then** `useReportListHotkeys.ts` and detail hooks register only from `SHORTCUTS` export (AD-10)
**And** no ad-hoc `window.addEventListener('keydown')` outside keyboard module (CI grep or review gate)

**Given** `?` pressed globally (except when typing in inputs)
**When** shortcuts modal opens
**Then** all bindings from EXPERIENCE.md keyboard map displayed

**Given** input/textarea focused
**When** shortcuts fire
**Then** suppressed except `/` focusing list search (EXPERIENCE.md)

**Technical notes:** `@mantine/hooks` `useHotkeys`. Link palette footer hints to SM-3 discoverability (EXPERIENCE.md).

**Dependencies:** E3-S4, E3-S9.
