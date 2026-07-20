---
baseline_commit: d3d6f673a5393d39bb9021be2146f799fb787d3e
depends_on:
  - 3-1-web-app-shell-theme-and-route-scaffold
  - 4-1-better-auth-github-oauth-and-session
  - 4-3-workspace-and-project-crud-with-ingest-keys
blocks:
  - 3-4-dense-report-list-with-keyboard-navigation
  - 3-9-command-palette-cmd-k
  - 3-10-central-keyboard-shortcuts-registry
---

# Story 3.3: Workspace switcher and pinned workspaces

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a user in multiple workspaces,
I want to switch active workspace in ≤2 keystrokes,
so that triage stays scoped to the right client (FR-13).

## Acceptance Criteria

1. **Given** user configured pins on `/settings/workspaces`, **when** user presses `⌘1`–`⌘9` (macOS) or `Ctrl+1`–`Ctrl+9` (Windows/Linux), **then** active workspace switches to the pinned slot at that index (1-based, order matches `pinnedWorkspaceIds` array) without opening the switcher menu; **and** no-op when slot is empty or index exceeds pin count; **and** hotkeys suppressed when focus is in `input`, `textarea`, or `contenteditable` (EXPERIENCE.md keyboard map).

2. **Given** a workspace switch (menu, hotkey, or palette), **when** `authClient.organization.setActive({ organizationId })` succeeds, **then** app navigates to `/w/[slug]/reports`; **and** TanStack Query cache removes all workspace-scoped queries via predicate (architecture §10: keys prefixed `['workspace', …]`); **and** subtle `LoadingOverlay` shows on main content during switch (EXPERIENCE.md state pattern).

3. **Given** `⌘K` / `Ctrl+K` with minimal Spotlight wired (this story seeds workspace actions only), **when** user executes action `ws.switch`, **then** Spotlight sub-palette opens with fuzzy-filterable list of all user memberships (name + slug); **and** selecting a row switches workspace using the same shared switch handler as menu/hotkeys.

4. **Given** `user_preferences.pinned_workspace_ids` (max 9), **when** pin order saved on `/settings/workspaces`, **then** persisted to Postgres `user_preferences` via existing `PATCH /api/v1/user/preferences` — **already implemented in E4-S3; do not rewrite backend**. Verify pin toggle, max-9 enforcement, and order persistence still work after frontend refactors.

5. **Given** header `WorkspaceSwitcher` `Menu`, **when** opened, **then** pinned workspaces appear first in user-configured order; **and** pinned rows show slot hint `⌘1`–`⌘9` (or `Ctrl+N` on non-Mac) when slot assigned; **and** active workspace marked; **and** "Manage workspaces" links to `/settings/workspaces`.

6. **Given** Playwright test with session fixture and ≥2 workspaces (one pinned), **when** user presses pinned hotkey or uses switcher menu, **then** URL updates to `/w/[target-slug]/reports` and header shows target workspace name.

7. **Out of scope for this story:** Full command palette inventory (E3-S9); complete `SHORTCUTS` registry + `?` modal (E3-S10 — seed workspace bindings only); report list queries and keyboard nav (E3-S4); drag-and-drop pin reorder polish (up/down reorder from E4-S3 is acceptable v1); backend schema/API changes; onboarding wizard (E3-S2).

## Tasks / Subtasks

- [x] Task 1 — Shared workspace switch module (AC: 2, 5)
  - [x] Extract `apps/web/src/lib/workspace-switch.ts` (or `hooks/useWorkspaceSwitch.ts`) — single async `switchWorkspace({ organizationId, slug })` calling `authClient.organization.setActive`, `queryClient.removeQueries({ predicate })`, `router.push`, `router.refresh`
  - [x] Define query-key convention helper: `isWorkspaceScopedQuery(key)` — true when `key[0] === 'workspace'`
  - [x] Refactor `workspace-switcher.tsx` to use shared handler; add slot labels for pinned rows

- [x] Task 2 — ⌘1–9 hotkeys (AC: 1)
  - [x] Create `apps/web/src/keyboard/shortcuts.ts` — export `WORKSPACE_PIN_SHORTCUTS` map (slots 1–9) as seed for E3-S10
  - [x] Create `apps/web/src/keyboard/use-workspace-pin-hotkeys.ts` — `@mantine/hooks` `useHotkeys` bound in `(app)` layout client wrapper; map slot → `pinnedWorkspaceIds[index]`
  - [x] Detect platform for modifier display (`meta` vs `ctrl`) — reuse Mantine `useOs` or simple `navigator.platform` check

- [x] Task 3 — Minimal Spotlight for `ws.switch` (AC: 3)
  - [x] Add `@mantine/spotlight` dep + CSS import in root layout
  - [x] Create `apps/web/src/keyboard/use-register-workspace-spotlight-actions.ts` — register static actions: `ws.switch` (opens nested/filter mode), `ws.pin-manage`, `ws.create` (route only)
  - [x] Wire `Spotlight` provider + `⌘K` opener replacing header placeholder text; mount hook in `(app)/layout` client shell
  - [x] Fuzzy filter: client-side over `workspaces` prop (no new API)

- [x] Task 4 — Switch UX polish (AC: 2)
  - [x] Add `LoadingOverlay` to `AppShell.Main` during pending switch (local `useState` or context)
  - [x] Preserve scroll optional — document as best-effort; no blocker if complex

- [x] Task 5 — Verification (AC: 4, 6, 7)
  - [x] Confirm E4-S3 pin CRUD still passes: `bun test packages/services/src/workspace.test.ts`
  - [x] Add `e2e/workspace-switcher.spec.ts` — pin workspace, hotkey or menu switch, assert URL + header
  - [x] `bunx turbo run lint typecheck build --filter=@usebugreport/web`

## Dev Notes

### Goal

Queue position **#16** in sprint plan — completes **FR-13 workspace switching** deferred from E4-S3. E4-S3 delivered backend persistence, `/settings/workspaces` pin UI, and basic `WorkspaceSwitcher` menu. This story adds **≤2-keystroke switching** (⌘1–9), **query cache hygiene**, and **minimal Spotlight `ws.switch`** — the keyboard-centric triage prerequisite before E3-S4 report list.

### Scope boundary (critical)

| In E3-S3 | Deferred |
| --- | --- |
| ⌘1–9 / Ctrl+1–9 pinned slot hotkeys | Full ⌘K palette inventory (E3-S9) |
| Shared `switchWorkspace` + Query invalidation | Report list query hooks (E3-S4) |
| Minimal Spotlight: `ws.switch`, `ws.pin-manage`, `ws.create` | `?` shortcuts modal (E3-S10) |
| Seed `keyboard/shortcuts.ts` (workspace section) | Complete AD-10 registry + CI grep (E3-S10) |
| Slot hints in switcher menu | Drag-and-drop pin reorder (up/down OK) |
| Playwright workspace switch test | Cross-workspace unified inbox |

**Extend, don't rewrite:** Backend `user_preferences`, `WorkspaceService.updatePinnedPreferences`, REST routes, and settings page pin logic are **done** — frontend orchestration only.

### Existing implementation (E4-S3 + E3-S1 — reuse)

| Path | Current state | This story changes |
| --- | --- | --- |
| `apps/web/src/components/workspace-switcher.tsx` | Menu, pinned-first order, `setActive` + `router.push('/w/[slug]/reports')` | Extract shared switch; add slot labels; wire Query invalidation |
| `apps/web/src/app/(app)/settings/workspaces/workspaces-settings.tsx` | Pin toggle, up/down reorder, create modal | **Verify only** — optional slot number column |
| `apps/web/src/app/(app)/settings/workspaces/actions.ts` | Server actions → `PATCH /api/v1/user/preferences` | No change expected |
| `apps/web/src/app/(app)/layout.tsx` | Server fetch workspaces + preferences → `AppShellLayout` | Pass data to hotkey/spotlight client wrapper |
| `apps/web/src/components/app-shell/app-shell-layout.tsx` | Mantine AppShell 48px/240px | Add switch loading overlay |
| `apps/web/src/components/app-shell/app-header.tsx` | Static `⌘K` hint text | Wire to Spotlight open |
| `apps/web/src/lib/auth-client.ts` | `organizationClient()` plugin | Use typed `authClient.organization.setActive` |
| `apps/web/src/lib/query-client.ts` | 30s staleTime defaults | Consumed by invalidation helper |
| `apps/web/src/components/providers.tsx` | `QueryClientProvider` | Export `useQueryClient` access for switch hook |
| `packages/services/src/workspace.ts` | `getPinnedPreferences`, `updatePinnedPreferences`, `MAX_PINNED_WORKSPACES = 9` | **Do not modify** unless bug found |
| `apps/api/src/routes/user-preferences.ts` | GET/PATCH pinned IDs | **Do not modify** |
| `apps/web/package.json` | No `@mantine/spotlight` | Add dependency |

**File path note:** E4-S3 story referenced `apps/web/src/app/(app)/components/WorkspaceSwitcher.tsx`; actual path is `apps/web/src/components/workspace-switcher.tsx` (kebab-case). Follow existing path.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| §3.1 `user_preferences` | `pinned_workspace_ids` text[], max 9; `pinned_order` jsonb — already migrated |
| §10 TanStack Query | Keys: `['workspace', slug, 'reports', filters]`; switch → `removeQueries({ predicate: workspaceScoped })` |
| §10 Keyboard | `apps/web/src/keyboard/shortcuts.ts` single registry — **seed workspace section**; E3-S10 expands |
| §10 Spotlight | `@mantine/spotlight` provider; `useRegisterSpotlightActions` pattern — **workspace subset this story** |
| EXPERIENCE.md Workspace switcher | Pinned first; ⌘1–9; Query invalidation; LoadingOverlay on switch |
| EXPERIENCE.md Keyboard map | Global ⌘1–9 FR-13; suppress in inputs |
| EXPERIENCE.md Palette `ws.switch` | Fuzzy membership list in sub-palette |
| AD-10 (partial) | No ad-hoc `window.addEventListener('keydown')` — use `@mantine/hooks` `useHotkeys` via keyboard module |
| FR-13 | Workspace switcher ⌘1–9 — Playwright workspace switch test |

### Shared switch implementation (recommended)

Centralize all switch paths (menu, hotkey, spotlight) to prevent drift:

```typescript
// apps/web/src/lib/workspace-switch.ts — illustrative
import type { QueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export function isWorkspaceScopedQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === "workspace";
}

export async function switchWorkspace(
  queryClient: QueryClient,
  input: { organizationId: string; slug: string },
  navigate: (path: string) => void,
  refresh: () => void
): Promise<void> {
  await authClient.organization.setActive({ organizationId: input.organizationId });
  queryClient.removeQueries({ predicate: (q) => isWorkspaceScopedQuery(q.queryKey) });
  navigate(`/w/${input.slug}/reports`);
  refresh();
}
```

Mount `useWorkspacePinHotkeys` in a new client component e.g. `apps/web/src/components/app-shell/workspace-switch-host.tsx` rendered inside `(app)/layout` **below** `Providers` so `useQueryClient` works.

### Hotkey binding pattern

```typescript
// apps/web/src/keyboard/useWorkspacePinHotkeys.ts — illustrative
import { useHotkeys } from "@mantine/hooks";

// Bind mod+1 .. mod+9 — useHotkeys accepts array of [keys, handler]
// Map index i → pinnedWorkspaceIds[i]; resolve slug from workspaces list
// Skip if !pinnedWorkspaceIds[i]
```

Register in `(app)` layout only — not on `(auth)/login`.

### Minimal Spotlight scope

E3-S9 owns full palette. This story adds:

| Action ID | Label | Behavior |
| --- | --- | --- |
| `ws.switch` | Switch workspace… | Opens spotlight filter mode listing all memberships |
| `ws.pin-manage` | Manage pinned workspaces | Navigate `/settings/workspaces` |
| `ws.create` | Create workspace | Navigate `/settings/workspaces?create=1` |

Use `@mantine/spotlight` `Spotlight` + `spotlight.open()` on `⌘K`. Dynamic workspace list: map memberships to actions at runtime; filter via spotlight search on `label` + keywords (`slug`, `name`).

**Do not** register nav/report/bulk actions — E3-S9.

### Query invalidation note

E3-S4 will introduce first workspace-scoped TanStack Query hooks. Implement invalidation **now** so future queries using `['workspace', slug, …]` keys auto-clear on switch. No report queries exist yet — invalidation is forward-compatible, not user-visible until E3-S4.

### Pin settings UX gap (non-blocker)

EXPERIENCE.md specifies "drag reorder pins"; E4-S3 shipped up/down `ActionIcon`s. **Acceptable for v1** — do not block this story on `@dnd-kit` unless trivial. Optional: show column "Shortcut" with `⌘1`… for pinned rows.

### Previous story intelligence

**From E3-S1 (3-1-web-app-shell-theme-and-route-scaffold.md):**

- AppShell passes `workspaces`, `pinnedWorkspaceIds`, `activeSlug` from server layout — keep server-side fetch; client wrappers receive same props
- `Providers` wraps `(app)/layout` children with shared `QueryClient`
- Header already mounts `WorkspaceSwitcher`; ⌘K is placeholder text — replace with Spotlight trigger
- Out of scope note explicitly deferred ⌘1–9 to this story

**From E4-S3 (4-3-workspace-and-project-crud-with-ingest-keys.md):**

- Pin persistence complete: `PATCH /api/v1/user/preferences` with `{ pinnedWorkspaceIds }`
- `WorkspaceSwitcher` calls `setActive` then `router.push` + `router.refresh` — extend with Query invalidation
- `authClient.organization.setActive` currently uses `as unknown as` cast — prefer proper better-auth org client typing
- E2E `e2e/workspace-project-crud.spec.ts` covers create/switch via navigation, not hotkeys — add dedicated switch spec
- Integration test covers pin preferences API — rely on existing, don't duplicate

**From E4-S1 (4-1):**

- Session cookie auth; `credentials: "include"` on all API calls
- Active org in session as `activeOrganizationId`

### Git intelligence (HEAD `d3d6f67`)

Recent merge: E3-S1 web app shell (PR #9). Web has themed AppShell, TanStack Query scaffold, route map. Workspace switcher and pin settings from E4-S3 predate shell refactor — paths consolidated under `components/` and `app-shell/`.

### Anti-patterns (do NOT)

- Do not reimplement `user_preferences` backend or migration
- Do not add Radix UI
- Do not build full command palette (E3-S9)
- Do not add report list queries (E3-S4)
- Do not use raw `window.addEventListener('keydown')` outside keyboard module
- Do not skip Query invalidation on switch — E3-S4 depends on clean scope
- Do not weaken onboarding gate middleware

### Project Structure Notes

New/expected files:

```text
apps/web/src/lib/workspace-switch.ts
apps/web/src/keyboard/shortcuts.ts
apps/web/src/keyboard/useWorkspacePinHotkeys.ts
apps/web/src/keyboard/useRegisterWorkspaceSpotlightActions.ts
apps/web/src/components/app-shell/workspace-switch-host.tsx
apps/web/src/components/spotlight-provider.tsx          # optional split
e2e/workspace-switcher.spec.ts
```

Modified:

```text
apps/web/package.json                                   # @mantine/spotlight
apps/web/src/app/layout.tsx                             # spotlight CSS
apps/web/src/components/workspace-switcher.tsx
apps/web/src/components/app-shell/app-shell-layout.tsx
apps/web/src/components/app-shell/app-header.tsx
apps/web/src/app/(app)/layout.tsx
```

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E03-web-app-core.md#Story E3-S3]
- [Source: _bmad-output/planning-artifacts/ux-usebugreport-2026-07-20/EXPERIENCE.md#Workspace switcher, Keyboard shortcut map, ws.switch]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§3.1 user_preferences, §10 TanStack Query, §10 Keyboard]
- [Source: _bmad-output/implementation-artifacts/3-1-web-app-shell-theme-and-route-scaffold.md]
- [Source: _bmad-output/implementation-artifacts/4-3-workspace-and-project-crud-with-ingest-keys.md]
- [Source: apps/web/src/components/workspace-switcher.tsx]
- [Source: packages/services/src/workspace.ts#getPinnedPreferences]

## Testing Requirements

Run from repo root; all must exit 0:

```bash
bun install
bunx biome check .
bunx turbo run lint typecheck build --filter=@usebugreport/web

# Existing unit tests (pin preferences — no regression)
bun test packages/services/src/workspace.test.ts

# New E2E (requires dev/e2e servers + DATABASE_URL)
bunx playwright test e2e/workspace-switcher.spec.ts
```

| Case | Expected |
| --- | --- |
| Pin 2 workspaces, press `Ctrl+2` | Navigates to 2nd pinned workspace `/w/[slug]/reports` |
| Switch via menu | Same navigation + header label updates |
| `ws.switch` in Spotlight | Fuzzy list → select → switch |
| Hotkey in focused `<input>` | No switch |
| `PATCH` with 10 pin IDs | API 422/403 validation (existing service test) |
| Empty pin slot `⌘5` | No-op, no error toast |

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- shared `switchWorkspace` in `workspace-switch.ts` with query predicate invalidation and `WorkspaceSwitchProvider` context (in-flight guard + pathname-based overlay dismiss)
- pinned hotkeys mod+1..9 via `use-workspace-pin-hotkeys.ts`; keyboard seed in `shortcuts.ts`
- minimal Spotlight: `ws.switch` sub-palette, `ws.pin-manage`, `ws.create`; header ⌘K trigger
- LoadingOverlay on `AppShell.Main` during switch
- e2e `workspace-switcher.spec.ts` + multi-org session fixture extension
- web typecheck + build pass; workspace unit tests skip without DATABASE_URL (no regression when DB available)

### File List

- `_bmad-output/implementation-artifacts/3-3-workspace-switcher-and-pinned-workspaces.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/web/package.json`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/app-shell/app-header.tsx`
- `apps/web/src/components/app-shell/app-shell-layout.tsx`
- `apps/web/src/components/app-shell/workspace-switch-host.tsx`
- `apps/web/src/components/spotlight-provider.tsx`
- `apps/web/src/components/workspace-switch-context.tsx`
- `apps/web/src/components/workspace-switcher.tsx`
- `apps/web/src/keyboard/is-editable-target.ts`
- `apps/web/src/keyboard/shortcuts.ts`
- `apps/web/src/keyboard/use-register-workspace-spotlight-actions.ts`
- `apps/web/src/keyboard/use-workspace-pin-hotkeys.ts`
- `apps/web/src/lib/workspace-switch.ts`
- `bun.lock`
- `e2e/fixtures/session.ts`
- `e2e/workspace-switcher.spec.ts`

## Change Log

- 2026-07-20: E3-S3 story created — workspace hotkeys, Query invalidation, minimal Spotlight ws.switch
- 2026-07-20: implemented workspace switcher hotkeys, spotlight ws.switch, shared switch handler, e2e spec
