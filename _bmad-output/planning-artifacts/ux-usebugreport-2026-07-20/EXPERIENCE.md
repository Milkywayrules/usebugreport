---
name: usebugreport
status: final
updated: 2026-07-20
sources:
  - {planning_artifacts}/prds/prd-usebugreport-2026-07-20/prd.md
  - {planning_artifacts}/prds/prd-usebugreport-2026-07-20/addendum.md
  - {planning_artifacts}/briefs/brief-usebugreport-2026-07-20/brief.md
  - ux-usebugreport-2026-07-20/DESIGN.md
---

# usebugreport — Experience Spine

> v1.0 launch UX contract. Mantine v7+ on Next.js App Router; TanStack Query + TanStack Table; `@mantine/spotlight` for ⌘K; `rrweb-player` for replay. Visual identity: `DESIGN.md`. Implements FR-11–FR-13, FR-6, FR-26, FR-8, FR-20–FR-21, LG-2, LG-3, LG-4, LG-9.

## Foundation

**Form factor:** Responsive web — desktop-first (≥1280px primary), functional down to 768px (tablet triage), read-only usable at 375px. Not a native mobile app.

**UI system:** Mantine v7+ with CSS-variable theming (`createTheme`, dark default). Component inventory in `DESIGN.md`. Data layer: TanStack Query (server state), TanStack Table (dense report list). Auth: better-auth GitHub OAuth + organization plugin (`setActive` workspace). **No Radix UI.**

**Tenancy model:** User → N **Workspaces** (organizations) → N **Projects** → **Reports**. Active workspace scopes all queries, settings, and API key context. Session persists active workspace in cookie/localStorage. Multi-tenancy via better-auth **Organization** plugin only — **no** better-auth Teams feature.

**Mandatory workspace gate (FR-8):** A signed-in user with zero **Workspace** memberships is hard-redirected to `/onboarding` on every authenticated route (including `/settings/account` and `/settings/workspaces`) until they belong to at least one **Workspace** (create during onboarding or accept an invite). Only `/onboarding`, `/login`, `/auth/callback`, and OAuth flows are reachable without membership. Middleware issues HTTP 302 to `/onboarding`; no `/w/[slug]/*` shell renders.

**RBAC (project-level):** viewer (read), reporter (read + SDK submit), developer (reporter + integrations + Linear push), admin (developer + delete + member mgmt). UI hides/disables actions user cannot perform — no "permission denied" pages for hidden nav items.

**Out of v1 UI scope:** Chrome extension screens, recording links, analytics dashboards, assignee field (v1.1 FF-5), cross-workspace unified inbox, GitHub/Jira integrations, agent `create_comment` API surface (FF-1; human web composer ships at v1).

## Information Architecture

### Route map

| Route | Name | Role min | Purpose |
|-------|------|----------|---------|
| `/login` | Login | public | GitHub OAuth CTA |
| `/auth/callback` | OAuth callback | public | better-auth handler redirect |
| `/onboarding` | Onboarding | authenticated (zero memberships) | Mandatory gate: create first **Workspace** + project + SDK snippet; sole authenticated destination until membership exists |
| `/w/[slug]` | Workspace root | member | Redirect → `/w/[slug]/reports` |
| `/w/[slug]/reports` | Report list | viewer | Dense triage queue (default landing) |
| `/w/[slug]/reports/[id]` | Report detail | viewer | Replay + panels + actions |
| `/w/[slug]/projects` | Project list | viewer | All projects in workspace |
| `/w/[slug]/projects/[id]` | Project detail | admin (edit) / viewer (read) | Ingest key, members, default Linear team |
| `/w/[slug]/settings` | Settings hub | viewer+ | Settings nav landing → General |
| `/w/[slug]/settings/general` | Workspace general | admin | Name, slug, tier badge |
| `/w/[slug]/settings/members` | Members | admin | Invite, roles (org-level) |
| `/w/[slug]/settings/projects` | Projects admin | admin | CRUD projects |
| `/w/[slug]/settings/api-keys` | API keys | admin | Create/rotate `ubr_live_*` keys |
| `/w/[slug]/settings/integrations` | Integrations | developer+ | Integration list |
| `/w/[slug]/settings/integrations/linear` | Linear config | developer+ | OAuth connect, default team mapping |
| `/w/[slug]/settings/webhooks` | Webhooks | admin | Endpoints + delivery debug log |
| `/w/[slug]/settings/retention` | Retention | admin | Tier max + shorten-within-tier |
| `/w/[slug]/settings/privacy` | Privacy masks | admin | SDK mask defaults display + docs link |
| `/w/[slug]/settings/usage` | Usage | viewer+ | Fair-use meter, tier, cap warnings |
| `/w/[slug]/settings/danger` | Danger zone | owner | GDPR workspace deletion |
| `/settings/account` | Account | authenticated | Profile, theme toggle, shortcut ref |
| `/settings/workspaces` | My workspaces | authenticated | Create workspace, pin order for ⌘1–9 |

**Deep links:** `/r/[id]` → resolve report → redirect to `/w/[slug]/reports/[id]` (preserves share URLs from Linear push).

### Navigation structure

```
AppShell
├── Header (48px)
│   ├── WorkspaceSwitcher (Menu)
│   ├── Breadcrumbs (contextual)
│   ├── Spotlight trigger hint "⌘K"
│   └── UserMenu (Avatar → Account, Workspaces, Logout)
├── Navbar (240px, collapsible)
│   ├── NavLink: Reports          [g r]
│   ├── NavLink: Projects         [g p]
│   ├── Divider
│   ├── NavLink: Settings         [g s]
│   └── UsageMeterMini (Pro/Free)
└── Main
    └── [surface content]
```

Global overlays (not routes): `@mantine/spotlight`, bulk action bar, keyboard shortcuts `Modal`, confirm `Modal` stacks (max depth 1).

### IA closure matrix (LG gates)

| Launch gate | Surface |
|-------------|---------|
| LG-2 Replay viewer + detail | `/w/[slug]/reports/[id]` |
| LG-3 Workspace/Project CRUD | `/settings/workspaces`, `/w/[slug]/settings/*`, `/w/[slug]/projects/*` |
| LG-4 Linear push | Report detail + ⌘K + bulk bar |
| LG-9 Superuser triage | Report list + Spotlight + workspace switcher |
| LG-7 GDPR deletion | `/w/[slug]/settings/danger` |
| LG-8 Fair-use | Usage settings + ingest error toast (SDK, out of web scope) |
| LG-10 Webhooks | `/w/[slug]/settings/webhooks` |
| LG-11 Retention | `/w/[slug]/settings/retention` |

## Voice and Tone

Microcopy. Brand posture: **competent, terse, zero fluff** — the user is a developer triaging at speed.

| Do | Don't |
|---|---|
| "Push to Linear" | "Send this bug to your issue tracker!" |
| "3 reports selected" | "You have selected 3 items" |
| "Linear token expired. Reconnect." | "Oops! Something went wrong with your integration 😅" |
| "847 of 2,000 reports this month" | "You're doing great! Keep reporting!" |
| "Replay unavailable — retention expired" | "Sorry, this content is no longer available" |
| Empty: "No open reports. Filters may be too narrow." | "You're all caught up! 🎉" |

Error copy pattern: **what happened + next action**. No error codes in user-facing text (log internally).

## Component Patterns

Behavioral. Visual specs in `DESIGN.md`.

| Pattern | Mantine / lib | Behavioral rules |
|---------|---------------|------------------|
| **Report list table** | TanStack Table + Mantine `Table` | Virtualization optional at >200 rows. Row click ≠ checkbox click. Single focused row (`aria-selected`) for keyboard nav. Sort: age desc default. Pagination 50/page (no infinite scroll). |
| **Report list filters** | `Group` + `TextInput` + `MultiSelect` + `DatePickerInput` | Filters sync to URL query params (`?status=open,in_progress&project=...&q=...&since=...`). `/` focuses search. Debounce search 300ms. Clear all: `Esc` when search focused empty. |
| **Bulk action bar** | `Affix position="bottom"` or sticky `Paper` | Visible when `selectedCount > 0`. Shows count + actions. `Esc` clears selection. Persists across filter change if IDs still visible. |
| **Command palette** | `@mantine/spotlight` | Registered actions + dynamic report/project search. Fuzzy match. Recent 5 commands per session (localStorage). `Enter` executes; `↑↓` navigate; `Esc` close. |
| **Workspace switcher** | `Menu` | Lists pinned first (user-configured order in `/settings/workspaces`). ⌘1–9 switches without opening menu. Switch triggers TanStack Query cache invalidation for workspace scope. |
| **Report detail tabs** | Mantine `Tabs` | Tabs: Replay (default), Console, Network, Metadata, Comments. Comments tab: thread list + composer (`Textarea` + submit) for reporter+; viewer read-only. Tab memory per report in session. `]`/`[` cycle tabs when detail focused. |
| **Comment composer** | Mantine `Textarea` + `Button` | Sticky at bottom of Comments tab. Submit disabled when empty. Optimistic append; revert on failure toast. Agent comments (post-FF-1) appear in same thread with API key name attribution. |
| **Replay viewer** | `rrweb-player` in `Box` | Lazy load signed URL. Loading: `Skeleton` aspect-video. Error: retry button. Keyboard when replay focused: `Space` play/pause, `←→` scrub ±5s. |
| **Linear push** | `Button` + `Modal` confirm (bulk) | Single: immediate with toast. Bulk: confirm modal listing count. Success: toast + Linear icon filled + URL in metadata panel. Failure: inline `Alert` with re-auth link. Idempotent: second push shows existing link. |
| **Status change** | `Menu` or single-key | Optimistic update via TanStack Query mutation. Revert on failure toast. Bulk status: one pick applies to all selected. |
| **Settings forms** | Mantine form + `useForm` | Auto-save where safe (retention slider); explicit Save for destructive-adjacent (webhook URL). Unsaved nav warning. |
| **API key create** | `Modal` | Show full key once; `CopyButton` + "I've saved this" dismiss. List shows prefix + scopes + last used. |
| **Ingest key display** | `Code` + rotate `ActionIcon` | Masked by default; reveal on click (audit log). Rotate confirms via `Modal`. |
| **GDPR deletion** | Multi-step `Modal` | Step 1: type workspace slug. Step 2: retention summary + checklist. Step 3: confirmation email notice. Cannot undo. |
| **Usage meter** | `Progress` + `Text` | Free: "23 / 30". Pro: "847 / 2,000" with fair-use label. ≥80%: `{colors.warning}` + banner on report list. At cap: banner + SDK 429 copy reference. |
| **Onboarding wizard** | `Stepper` | Steps: (1) Create **Workspace** + first project (2) Copy SDK snippet (3) Verify first report (poll/list link). **Skip blocked until step 1 completes** — workspace must exist before "Skip to dashboard" or any `/w/[slug]/*` route. Skip allowed only after step 1 (matches post–step-1 skip rule). |

## State Patterns

| State | Surface | Treatment |
|-------|---------|-----------|
| **Cold load** | Report list | 8× `Skeleton` rows matching `{spacing.density-row-height}`. Header/sidebar render immediately from shell. |
| **Empty queue** | Report list | "No reports yet." + if admin: "Install the SDK" link → onboarding. If filters active: "No matches. Clear filters." |
| **Empty project** | Project list | "No projects." + `Button` Create project (admin). |
| **Report loading** | Detail | Replay area `Skeleton`; tabs skeleton lines. |
| **Replay expired** | Detail replay tab | "Replay expired — {tier} retention is {N} days." Metadata + console may still show if within metadata retention. |
| **403 project** | Detail | Full-page `Alert`: "You don't have access to this project." Link back to list. |
| **Linear not configured** | Push action | `Tooltip`: "Connect Linear in Settings." Push button disabled. Palette action shows setup shortcut. |
| **Linear auth expired** | Push | `Alert variant="light" color="yellow"`: "Linear token expired." `Button` "Reconnect" → OAuth. Report stays in queue. |
| **Bulk partial failure** | Bulk push | Toast: "{n} pushed, {m} failed." Failed IDs listed in `Notification` expand. |
| **Workspace switching** | Global | Subtle top `LoadingOverlay` on main; preserve scroll after switch if returning. |
| **Offline** | Global | Mantine `Notification` once: "Offline. Actions will retry when connected." Read-only cached list from TanStack Query. |
| **Search no results** | List / Spotlight | List: empty filter state. Spotlight: "No matches" + show static action list below. |

## Interaction Primitives

### Keyboard shortcut map (complete)

**Global (most surfaces)**

| Shortcut | Action | FR |
|----------|--------|-----|
| `⌘K` / `Ctrl+K` | Open command palette (Spotlight) | FR-12 |
| `⌘1`–`⌘9` / `Ctrl+1–9` | Switch to pinned workspace 1–9 | FR-13 |
| `?` | Open keyboard shortcuts reference modal | — |
| `Esc` | Close top overlay; clear bulk selection; blur search | — |

**Navigation (vim-style, sequential keys)**

| Shortcut | Action |
|----------|--------|
| `g` then `r` | Go to Reports |
| `g` then `p` | Go to Projects |
| `g` then `s` | Go to Settings |
| `g` then `i` | Go to Integrations (Linear) |

**Report list (when list focused — auto-focus on route enter)**

| Shortcut | Action | FR |
|----------|--------|-----|
| `j` / `↓` | Move focus to next row | FR-11 |
| `k` / `↑` | Move focus to previous row | FR-11 |
| `x` | Toggle select on focused row | FR-11 |
| `Shift+X` | Select all visible rows | FR-11 |
| `Enter` | Open focused report in detail | FR-11 |
| `o` | Open focused report in new tab | — |
| `1` | Set status → open (focused or selected) | FR-11 |
| `2` | Set status → in_progress | FR-11 |
| `3` | Set status → resolved | FR-11 |
| `4` | Set status → closed | FR-11 |
| `5` | Set status → duplicate | FR-11 |
| `p` | Push to Linear (focused or bulk if selected) | FR-21 |
| `c` | Copy agent summary JSON to clipboard | FR-12 |
| `/` | Focus filter search input | FR-11 |
| `f` | Open filter popover (status, project, date) | FR-11 |

**Report detail**

| Shortcut | Action |
|----------|--------|
| `b` / `Backspace` | Back to list (preserve filters) |
| `p` | Push to Linear |
| `c` | Focus comment composer (Comments tab; switches tab if needed) |
| `l` | Copy report URL |
| `1`–`5` | Change status |
| `[` / `]` | Previous / next tab |
| `Space` | Play/pause replay (when replay tab focused) |

**Spotlight (when open)**

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Move selection |
| `Enter` | Execute selected action |
| `Esc` | Close |

Implementation: `@mantine/hooks` `useHotkeys` registered per-route via layout hooks; disable when `input`/`textarea` focused except `/` which focuses search. Register shortcuts in a central `SHORTCUTS` constant for palette + `?` modal.

### Command palette action inventory

Spotlight actions registered via `spotlight.registerActions()` and dynamic search handlers.

**Navigation actions (static)**

| ID | Label | Keywords | Shortcut hint | Route/action |
|----|-------|----------|---------------|--------------|
| `nav.reports` | Go to Reports | reports, queue, bugs, triage | `g r` | `/w/[slug]/reports` |
| `nav.projects` | Go to Projects | projects, apps | `g p` | `/w/[slug]/projects` |
| `nav.settings` | Go to Settings | settings, preferences | `g s` | `/w/[slug]/settings` |
| `nav.integrations.linear` | Linear integration | linear, tracker, oauth | `g i` | `/w/[slug]/settings/integrations/linear` |
| `nav.api-keys` | API keys | api, mcp, agent, token | — | `/w/[slug]/settings/api-keys` |
| `nav.webhooks` | Webhooks | webhook, automation | — | `/w/[slug]/settings/webhooks` |
| `nav.usage` | Usage & billing | usage, quota, fair use | — | `/w/[slug]/settings/usage` |
| `nav.onboarding` | SDK setup | sdk, install, snippet | — | `/onboarding` |

**Workspace actions (static)**

| ID | Label | Keywords | Action |
|----|-------|----------|--------|
| `ws.switch` | Switch workspace… | workspace, client, org | Opens workspace sub-palette (fuzzy list) |
| `ws.create` | Create workspace | new workspace | `/settings/workspaces?create=1` |
| `ws.pin-manage` | Manage pinned workspaces | pin, reorder | `/settings/workspaces` |

**Report actions (context-aware — require report focus or selection)**

| ID | Label | Keywords | Action |
|----|-------|----------|--------|
| `report.open` | Open report… | open, goto | Fuzzy search reports by title/ID |
| `report.status.open` | Mark open | status, open | PATCH status |
| `report.status.in_progress` | Mark in progress | status, progress | PATCH status |
| `report.status.resolved` | Mark resolved | status, resolved, done | PATCH status |
| `report.status.closed` | Mark closed | status, closed | PATCH status |
| `report.status.duplicate` | Mark duplicate | status, duplicate | PATCH status |
| `report.push-linear` | Push to Linear | linear, push, tracker, issue | Linear push mutation |
| `report.copy-summary` | Copy agent summary | copy, summary, agent, mcp | Clipboard JSON from summary endpoint |
| `report.copy-url` | Copy report URL | copy, link, share | Clipboard `/r/[id]` |
| `report.copy-id` | Copy report ID | copy, id | Clipboard `rpt_*` |

**Bulk actions (when selection > 0, promoted to top of palette)**

| ID | Label | Action |
|----|-------|--------|
| `bulk.status` | Change status for {n} reports… | Sub-menu status picker |
| `bulk.push-linear` | Push {n} reports to Linear | Bulk push with confirm |

**Settings / admin actions**

| ID | Label | Action |
|----|-------|--------|
| `settings.theme` | Toggle dark/light theme | Toggle Mantine colorScheme |
| `settings.shortcuts` | Keyboard shortcuts | Open `?` modal |

**Dynamic search providers**

| Provider | Trigger | Source |
|----------|---------|--------|
| Reports | typing ≥2 chars | `GET /api/v1/reports/search?q=` |
| Projects | typing ≥2 chars | Project list filter client-side |
| Workspaces | in switch sub-palette | User memberships |

Recent commands: store `{actionId, timestamp}` last 5 in `localStorage` key `ubr_spotlight_recent`; show section "Recent" at top when palette opens with empty query.

### Mouse / pointer

- Row click → open detail (unless click target is checkbox or action icon).
- Checkbox click → toggle select only; does not navigate.
- Shift+click row → range select from last focused.
- Cmd/Ctrl+click → open new tab.
- Hover row → reveal quick actions (`ActionIcon`: push, copy link) on `≥ md`; hidden on touch (use palette instead).

**Banned in v1:** infinite scroll, drag-to-reorder, modal-on-modal, hover-only critical actions on desktop without keyboard equivalent.

## Accessibility Floor

Target: **WCAG 2.1 AA** on core triage flows (FR-11 NFR, LG-9).

### Focus management

- **Route change:** Move focus to `h1` or main landmark (`main` tabIndex=-1 skip target).
- **Report list enter:** Focus first row (or last focused row if returning from detail).
- **Detail enter:** Focus report title heading.
- **Spotlight open:** Focus search input (Spotlight default). Trap focus via Mantine `FocusTrap` in modals.
- **Spotlight close:** Return focus to element that opened it (or list focused row).
- **Bulk bar appear:** Focus not stolen; screen reader `aria-live="polite"` announces "{n} selected".
- **Modal close:** Restore trigger focus.

### ARIA — dense report list

```html
<!-- structural intent for implementation -->
<table role="grid" aria-label="Reports" aria-rowcount="{total}" aria-colcount="7">
  <tr role="row" aria-selected="{selected}" aria-rowindex="{index}">
    <td role="gridcell"><Checkbox aria-label="Select report {title}" /></td>
    <td role="gridcell"><Badge aria-label="Status: open">...</Badge></td>
    ...
  </tr>
</table>
```

- Keyboard-focused row: `aria-selected="true"` on focused row (distinct from bulk checkbox selection).
- Sortable columns: `aria-sort="ascending|descending|none"`.
- Filter region: `role="search"` on filter bar with `aria-label="Filter reports"`.
- Bulk bar: `role="toolbar"` `aria-label="Bulk actions"`.
- Status changes: `aria-live="polite"` toast confirmation.
- Linear link icon: `aria-label="Open in Linear"` when linked; `aria-label="Not linked to Linear"` when not.

### Keyboard operability

- All FR-11/FR-12 actions reachable without pointer.
- Visible focus ring: Mantine `focusRingStyles` using `{colors.focus-ring}` — never `outline: none` without replacement.
- `?` modal lists all shortcuts; printable from account settings.
- Color not sole status indicator — badge includes text label.

### Motion

- Respect `prefers-reduced-motion`: disable replay auto-play; shorten Mantine transitions to 0ms.

### Screen reader page announcements

On navigation: visually hidden live region — "Reports, {n} items, {activeWorkspace}" / "Report detail, {title}, status open".

## Responsive & Platform

| Breakpoint | Behavior |
|------------|----------|
| `≥ xl` (1280px+) | Full split detail (replay + side panel). Sidebar expanded. All columns visible in list. |
| `lg` (1024–1279px) | Sidebar collapsed to icons (52px). Detail split 50/50. Hide reporter column in list. |
| `md` (768–1023px) | Sidebar → `Drawer` hamburger. Detail stacks (replay top, tabs bottom). Bulk bar full-width bottom. |
| `< md` | Read-only triage viable; keyboard shortcuts still work with external keyboard. Spotlight fullscreen. |

Touch: no hover quick actions; long-press row → context `Menu` with status/push/copy.

## Inspiration & Anti-patterns

**Lifted from Linear:** ⌘K as command center; `j/k` list nav; single-key status; workspace switcher with number pins; dense table; minimal animation.

**Lifted from GitHub:** Settings left-nav pattern; danger zone deletion flow with slug confirmation.

**Lifted from Jam (anti-competitor parity):** Agent summary copy action; console/network panels adjacent to replay — but **keyboard model exceeds Jam**.

**Rejected — Consumer onboarding illustrations:** SDK setup is a code block, not a cartoon wizard.

**Rejected — Dashboard analytics:** Usage meter only (FR fair-use); no charts/graphs in v1.

**Rejected — Assignee UI:** Deferred FF-5; no disabled assignee column teasing v1.1.

**Rejected — Radix/shadcn:** Stack constraint; Mantine-only.

## Key Flows

### Flow 1 — Maya files a client bug and pushes to Linear (UJ-1)

**Protagonist:** Maya, freelance dev, six client workspaces, Cursor daily.

1. **SDK submit (out of web app):** In client staging app, Maya reproduces checkout bug → triggers SDK widget (`⌘+Shift+B` integrator default or floating button) → SDK captures 2-min replay, console, network, screenshot → POST ingest → success toast in host app.
2. **Workspace switch:** Maya opens usebugreport → `⌘3` switches to client workspace "Acme Staging" (pinned slot 3).
3. **Triage list:** Report list loads; new report at top (age "just now", status `open`, project "Checkout"). List auto-focuses top row.
4. **Review:** `Enter` opens detail. Replay tab auto-plays. Maya scrubs to click moment, glances Console tab (3 errors), Network tab (500 on POST /api/checkout).
5. **Climax — Push to Linear:** `⌘K` → types "push" → Enter on "Push to Linear". Mutation runs; toast "Linear issue created". Linear icon fills; external link appears in header. Issue title prefixed `[UBR]`.
6. **Agent handoff:** `⌘K` → "Copy agent summary". Maya pastes into Cursor; agent calls `get_report_summary` later for Hermes bot.
7. **Resolution:** `b` back to list; status remains `open` until client triages in Linear. Maya `⌘1` switches to personal workspace.

**Failure beats:**
- Ingest 429 (Free cap): host app SDK shows upgrade link; report not created.
- Linear token expired: push fails → inline re-auth → retry `p` succeeds.

### Flow 2 — Agency Apex triages today's cross-client queue (UJ-2)

**Protagonist:** Apex lead dev, 20 client projects across workspaces.

1. **Per-workspace triage (v1 constraint):** Apex opens agency home workspace first — not cross-workspace inbox (deferred). Uses date filter "Today" saved in URL.
2. **Keyboard sweep:** `j/k` through 12 reports; `x` selects 4 open staging bugs; bulk bar appears.
3. **Bulk status:** Bulk bar → Status → "in_progress" (or palette `bulk.status`).
4. **Replay review:** `Enter` on highest priority; reviews replay + console; `]` to Metadata tab for environment URL.
5. **Climax — Bulk push:** `⌘K` → "Push 4 reports to Linear" → confirm modal → parallel mutations. 3 succeed; 1 fails (wrong team mapping). Toast summarizes.
6. **Fix failure:** Failed report → detail → Settings link in error → correct team mapping → `p` retry succeeds.
7. **Next workspace:** `⌘4` switch to next client; repeat. [ASSUMPTION] Apex workflow is sequential workspace hops — true cross-workspace queue is Agency tier later.

### Flow 3 — QA lead regression search (UJ-3, web-assisted)

**Protagonist:** QA lead, in-house product org.

1. Agent session (out of band) calls `search_reports` → returns IDs.
2. **Web confirm:** QA opens `/w/[slug]/reports?q=checkout+null+TypeError` — FTS filter matches agent results.
3. **Duplicate triage:** Selects 2 duplicates via `x`; `5` marks duplicate; opens primary report; `c` focuses composer → notes duplicate link in comment thread.
4. **Climax:** Primary report `p` pushes to Linear with full console excerpt in issue body.
5. **Resolution:** Filter saved URL shared with team in Slack.

### Flow 4 — GDPR workspace deletion (UJ-4)

**Protagonist:** EU client admin, contract ended.

1. `/w/[slug]/settings/danger` → "Delete workspace".
2. Modal step 1: type slug `acme-corp` to enable Next.
3. Step 2: summary — "142 reports, 3 projects, 2 integrations, blobs in R2" + 72h SLA notice.
4. **Climax:** Confirm → job enqueued; redirect to `/settings/workspaces` with banner "Deletion in progress for Acme Corp."
5. Email on completion. Audit log entry viewable 90 days.

### Flow 5 — First-time onboarding (SDK install)

**Protagonist:** New solo dev, first workspace.

1. GitHub OAuth → middleware detects zero memberships → hard redirect to `/onboarding` (no other authenticated route accessible).
2. Step 1: **Workspace** name + first project name "My App" → creates organization + project + ingest key; membership gate satisfied.
3. Step 2: SDK snippet with `projectKey` pre-filled; `CopyButton`. Docs link for `@usebugreport/browser` init options. "Skip to dashboard" enabled only from here (after step 1).
4. Step 3: "Waiting for first report…" — polls list every 5s; on first ingest → celebration-free redirect to report detail.
5. **Climax:** First replay visible; inline tip: "Press ? for keyboard shortcuts."

## Screen Specifications

### `/login`

| Aspect | Spec |
|--------|------|
| Layout | Centered `Paper` max-width 400px on `{colors.surface-base}` |
| Components | `Title`, `Text`, `Button` (GitHub icon), `Anchor` terms |
| States | Default; loading (OAuth redirect spinner on button) |
| Empty/error | OAuth failure query param → `Alert` |

### `/onboarding`

| Aspect | Spec |
|--------|------|
| Layout | Centered `Stepper` max-width 640px |
| Components | `Stepper`, `TextInput`, `Code`, `CopyButton`, `Button`, `Loader` |
| Gate | Hard gate for users with zero **Workspace** memberships; blocks all other authenticated routes until step 1 completes |
| Steps | Create **Workspace** + first project → Copy SDK → Wait for report |
| Skip | "Skip to dashboard" **disabled until step 1 completes** (workspace exists); after step 1 → report list |

### `/w/[slug]/reports` — Report list

| Aspect | Spec |
|--------|------|
| Layout | Filter bar + TanStack Table + pagination footer |
| Columns | ☐ · Status · Title · Project · Reporter · Age · Linear |
| Components | `Table`, `Checkbox`, `Badge`, `TextInput`, `MultiSelect`, `Pagination`, `Affix` bulk bar, `Menu` |
| Filters | Status (multi), Project (multi), Date range, Full-text `q` |
| Loading | 8 skeleton rows |
| Empty | See State Patterns |
| Error | `Alert` + retry button; cached data if stale |
| Role gates | Push/status shortcuts hidden for viewer |

### `/w/[slug]/reports/[id]` — Report detail

| Aspect | Spec |
|--------|------|
| Layout | Header (title, status `Menu`, actions) + split content |
| Header actions | Push Linear `Button`, Copy summary `ActionIcon`, Copy URL, Delete (admin) |
| Tabs | Replay · Console · Network · Metadata · Comments |
| Replay tab | `rrweb-player`, transport controls |
| Console tab | Level filter `SegmentedControl`; `ScrollArea`; log lines monospace |
| Network tab | Sortable table; expand row for headers/body (redacted) |
| Metadata tab | `DescriptionList` — URL, viewport, UA, releaseId, reporter, timestamps |
| Comments tab | Thread list (author + timestamp) + sticky composer (`Textarea` + submit) for reporter+; viewer read-only. Empty: "No comments yet." Agent comments (FF-1) merge into same thread. |
| Loading | Tab skeletons |
| 403/404 | `Alert` + back link |

### `/w/[slug]/projects` — Project list

| Aspect | Spec |
|--------|------|
| Columns | Name · Reports count · Created · Actions |
| Actions | admin: Edit, Delete (confirm modal) |
| Create | `Button` → `Modal` with name field |

### `/w/[slug]/projects/[id]` — Project detail

| Aspect | Spec |
|--------|------|
| Sections | General (name), Ingest key (rotate), Members (`Table`), Linear default team (`Select`, developer+) |
| Components | `Tabs` or `Stack` sections, `Code`, `Table`, `Select`, `Button` |

### `/w/[slug]/settings/*`

| Page | Key components |
|------|----------------|
| general | `TextInput` name, slug read-only, tier `Badge` (v1 launch: Free or Pro only; Studio/Agency badges reserved — defined, not sellable at v1.0) |
| members | `Table`, invite `Modal`, role `Select` |
| projects | Project CRUD table |
| api-keys | Key list, create `Modal` with scope `Checkbox` group |
| integrations/linear | Connect `Button`, team `Select`, disconnect `Button` destructive |
| webhooks | URL `TextInput`, events `MultiSelect`, delivery log `Table` |
| retention | Tier max display, shorten `Slider` (admin) |
| privacy | Mask defaults info + SDK docs `Anchor` |
| usage | `{components.usage-meter-*`, tier CTA upgrade |
| danger | Delete flow modals |

### `/settings/workspaces`

| Aspect | Spec |
|--------|------|
| Features | List memberships, create workspace, drag reorder pins (⌘1–9 order), pin toggle |
| Components | `Table` or sortable list, `Modal` create, pin `ActionIcon` |

### `/settings/account`

| Aspect | Spec |
|--------|------|
| Features | Avatar, GitHub handle, theme `SegmentedControl`, link to shortcuts modal |

## SDK Widget (capture surface — embed, not web route)

Document for story cross-reference (FR-1–FR-4, LG-1):

| Aspect | Spec |
|--------|------|
| Trigger | Floating `ActionIcon` bottom-right (integrator configurable) or host-bound hotkey |
| Submit modal | Mantine-less lightweight DOM in shadow root — title input, description textarea, Submit/Cancel |
| Privacy | Password fields masked in replay; auth headers redacted in preview list |
| Success | Close modal + host callback; error states for 401/429 with tier message |
| Note | SDK UI is **not** Mantine — keep bundle minimal; match usebugreport dark aesthetic loosely |

## Mantine Theming Implementation Notes

Reference `DESIGN.md` tokens. Implementation checklist for dev stories:

1. **`theme.ts`:** `createTheme` with CSS variables resolver; map `{colors.accent}` → Mantine primary palette override.
2. **`ColorSchemeScript`:** default `"dark"` in root layout.
3. **`ModalsProvider`, `Notifications`:** root providers alongside `MantineProvider`.
4. **Spotlight:** `@mantine/spotlight` separate provider; register actions in `useRegisterSpotlightActions` hook.
5. **Density:** global `size="xs"` defaults per `DESIGN.md`.
6. **Fonts:** `next/font/google` Inter + JetBrains Mono; assign via `theme.fontFamily` and `theme.fontFamilyMonospace`.
7. **No Radix:** lint rule / code review gate.

## Open Items & Assumptions

| Tag | Item |
|-----|------|
| [ASSUMPTION] | Pinned workspace order stored per-user in DB; max 9 pins |
| [ASSUMPTION] | Comments tab visible at v1 with human composer (FR-26); agent-authored comments appear post-FF-1 in same thread |
| [ASSUMPTION] | Cross-workspace "today queue" is sequential ⌘1–9 hops, not unified inbox |
| [NOTE FOR UX] | Assignee column omitted entirely until FF-5 — no placeholder column |
| [NOTE FOR UX] | Studio and Agency tiers defined in PRD §9 but not sellable at v1.0 — show as "coming soon" in usage/billing UI; tier badges Free/Pro only at launch |

## Sources Reconciliation

| Upstream | UX decision |
|----------|-------------|
| FR-11 bulk assign deferred | No assignee UI in list or detail |
| FR-26 human report comments | Comments tab with composer; `c` focuses composer on report detail |
| FR-16 agent create_comment not launch gate | Agent API write deferred FF-1; same thread as human comments when shipped |
| Council: no cross-workspace analytics | No unified inbox surface |
| Addendum: never Radix | Mantine + base-ui escape hatch only |
| SM-3 ⌘K adoption metric | Shortcuts modal + palette footer hints promote discoverability |
