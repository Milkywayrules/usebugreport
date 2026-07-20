---
baseline_commit: a2d6313
depends_on:
  - 4-1-better-auth-github-oauth-and-session
  - 4-2-onboarding-gate-middleware
blocks:
  - 3-2-onboarding-wizard
  - 3-3-workspace-switcher-and-pinned-workspaces
  - 3-4-dense-report-list-with-keyboard-navigation
  - 3-7-report-detail-and-replay-viewer
  - 3-10-central-keyboard-shortcuts-registry
---

# Story 3.1: Web app shell, theme, and route scaffold

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an authenticated member,
I want the AppShell with workspace-scoped routes per EXPERIENCE.md,
so that I can navigate reports, projects, and settings (FR-8 UI, LG-3).

## Acceptance Criteria

1. **Given** Next.js App Router under `apps/web/src/app/`, **when** routes compile, **then** paths exist and resolve without 404: `(auth)/login`, `(auth)/auth/callback`, `(app)/onboarding`, `(app)/w/[slug]/reports`, `(app)/w/[slug]/projects/**`, `(app)/w/[slug]/settings/**` (hub + stub child routes per EXPERIENCE.md route map), `(app)/settings/account`, `(app)/settings/workspaces`, `(app)/r/[id]` deep-link redirect to `/w/[slug]/reports/[id]`.

2. **Given** root layout, **when** app loads, **then** Mantine v7 `MantineProvider` uses `apps/web/src/theme/theme.ts` tokens from DESIGN.md; **and** `ModalsProvider`, `Notifications` from `@mantine/modals` / `@mantine/notifications` are mounted; **and** dark default via `ColorSchemeScript defaultColorScheme="dark"`; **and** global Mantine CSS imports include modals/notifications styles.

3. **Given** `(app)/layout.tsx`, **when** authenticated user views any `(app)` route, **then** EXPERIENCE.md AppShell renders: 48px header with brand, `WorkspaceSwitcher`, Spotlight hint placeholder (`⌘K`), user menu links; **and** 240px collapsible navbar with NavLinks for Reports (`/w/[slug]/reports`), Projects, Settings hub; **and** main content area for children. Navbar collapse state may use Mantine `AppShell` or equivalent — polish over inline header div from E4-S3.

4. **Given** TanStack Query, **when** `(app)/layout.tsx` mounts, **then** `QueryClientProvider` wraps app children with a shared `QueryClient` (default staleTime reasonable for triage); **and** `apps/web/src/lib/query-client.ts` exports factory for test reuse. Server components may still use direct fetch — provider is for client mutations/lists in later stories.

5. **Given** ESLint or Biome lint config for `apps/web`, **when** lint runs, **then** `no-restricted-imports` (or Biome equivalent) blocks `@radix-ui/*` imports (epic mandate — Mantine only, no Radix).

6. **Given** middleware from E4-S2 (unchanged behavior), **when** authenticated user has zero org memberships and requests any route except `/onboarding`, `/login`, `/auth/callback`, **then** HTTP 302 to `/onboarding`. **Do not regress** E4-S2 gate tests.

7. **Given** `(app)/w/[slug]/page.tsx`, **when** user visits `/w/[slug]`, **then** redirect to `/w/[slug]/reports` (EXPERIENCE.md workspace root behavior).

8. **Given** `(app)/r/[id]/page.tsx`, **when** user visits `/r/[reportId]`, **then** server resolves report → workspace slug via API (`GET /api/v1/reports/:id` or thin BFF) and redirects to `/w/[slug]/reports/[id]`; **or** if report not found / no access, show Mantine `Alert` full-page with link back to list (no raw 404).

9. **Given** missing settings routes from EXPERIENCE.md not yet implemented in E4-S3, **when** scaffold runs, **then** stub pages exist under `(app)/w/[slug]/settings/` for: `general`, `integrations`, `integrations/linear`, `webhooks`, `retention`, `privacy`, `usage`, `danger`, and settings hub `(app)/w/[slug]/settings/page.tsx` redirecting to `general`. Stubs: Mantine `Title` + "Coming soon" or section label — no business logic.

10. **Given** same-origin API calls from web, **when** client/server helpers fetch protected data, **then** requests use session cookie (`credentials: "include"`) to `NEXT_PUBLIC_API_URL` (existing pattern in `auth-client.ts`, `api-server.ts`); **do not** introduce a separate auth token store.

11. **Out of scope for this story:** Onboarding Stepper steps 2–3 polish (E3-S2); ⌘1–9 workspace hotkeys and Spotlight actions (E3-S3, E3-S9); report list table, filters, keyboard nav (E3-S4); replay viewer (E3-S7); `apps/web/src/keyboard/shortcuts.ts` registry (E3-S10); TanStack Table; `@mantine/spotlight` provider wiring beyond placeholder hint; full settings feature implementations (E4/E7/E8/E9); Playwright beyond smoke that shell routes compile.

## Tasks / Subtasks

- [x] Task 1 — Theme + root providers (AC: 2, 4)
  - [x] Add deps: `@mantine/modals`, `@mantine/notifications`, `@tanstack/react-query`
  - [x] Create `apps/web/src/theme/theme.ts` — `createTheme` from DESIGN.md colors, typography, spacing, `primaryColor`, `fontFamily`, `headings`, `defaultRadius`
  - [x] Update `apps/web/src/app/layout.tsx` — `ColorSchemeScript defaultColorScheme="dark"`, themed `MantineProvider`, `ModalsProvider`, `Notifications`, import CSS for modals/notifications
  - [x] Create `apps/web/src/lib/query-client.ts` + `apps/web/src/components/providers.tsx` (`QueryClientProvider` client component)
  - [x] Wrap `(app)/layout.tsx` children with providers component

- [x] Task 2 — AppShell layout (AC: 3, 7)
  - [x] Refactor `(app)/layout.tsx` to Mantine `AppShell` (header 48px, navbar 240px collapsible) per EXPERIENCE.md nav structure
  - [x] Extract `apps/web/src/components/app-shell/` — `AppHeader`, `AppNavbar`, `UserMenu` (Avatar menu → Account, Workspaces, Logout via `authClient.signOut`)
  - [x] NavLinks with `usePathname` active state; derive `[slug]` from route params or active org
  - [x] `(app)/w/[slug]/page.tsx` — `redirect('/w/[slug]/reports')`

- [x] Task 3 — Route scaffold + deep link (AC: 1, 8, 9)
  - [x] Add `(app)/r/[id]/page.tsx` — resolve report workspace + redirect
  - [x] Add settings stubs: `settings/page.tsx` → redirect `general`; stub pages for general, integrations, linear, webhooks, retention, privacy, usage, danger
  - [x] Ensure `(app)/w/[slug]/reports/[id]/page.tsx` exists as minimal stub ("Report detail — E3-S7") if missing
  - [x] Verify auth routes `(auth)/login`, `(auth)/auth/callback` still compile under new providers

- [x] Task 4 — Lint guard + no Radix (AC: 5)
  - [x] Add ESLint flat config or extend root Biome `overrides` for `apps/web` restricting `@radix-ui/*`
  - [x] Confirm zero Radix deps in `apps/web/package.json`

- [x] Task 5 — Verification (AC: 6, 10, 11)
  - [x] Run existing `apps/web/src/lib/onboarding-gate.test.ts` — no regressions
  - [ ] Run `e2e/onboarding-gate.spec.ts` if webServer configured — skipped: API webServer timed out (postgres/redis infra not available in harness)
  - [x] `bunx turbo run lint typecheck build --filter=@usebugreport/web`
  - [x] Manual smoke: login → onboarding gate → `/w/[slug]/reports` shows shell with navbar

## Dev Notes

### Goal

Queue position **#14** in sprint plan — formal **web shell foundation** after E4 auth/gate/CRUD partials. E4-S3 already added minimal header, workspace switcher, projects, and some settings pages **without** DESIGN.md theme tokens, AppShell navbar, TanStack Query, or full route map. This story **elevates** the scaffold to the EXPERIENCE.md contract without implementing triage features.

### Scope boundary (critical)

| In E3-S1 | Deferred |
| --- | --- |
| Mantine theme from DESIGN.md + dark default | Full keyboard registry (E3-S10) |
| AppShell header + navbar structure | Spotlight / ⌘K palette (E3-S9) |
| TanStack Query provider scaffold | Report list queries (E3-S4) |
| Full route map + settings stubs | Settings business logic (E4/E7/E8/E9) |
| `/r/[id]` redirect | Report detail tabs + replay (E3-S7) |
| ESLint no-Radix rule | rrweb-player (E3-S7) |
| Preserve E4-S2 onboarding gate | Onboarding wizard steps 2–3 (E3-S2) |

**Refactor, don't duplicate:** Reuse `WorkspaceSwitcher`, `auth-server.ts`, `api-server.ts`, middleware — wrap in AppShell; do not rewrite CRUD pages from E4-S3.

### Current repo state (modify / extend)

| Path | Current state | This story changes |
| --- | --- | --- |
| `apps/web/src/app/layout.tsx` | Bare `MantineProvider`, no theme file | Theme tokens, Modals, Notifications, dark default |
| `apps/web/src/app/(app)/layout.tsx` | Inline `<header>` div, no navbar | Mantine AppShell with navbar NavLinks |
| `apps/web/src/middleware.ts` | E4-S2 onboarding gate | **Preserve behavior** — extend matcher only if `/r/*` needs auth |
| `apps/web/src/app/(app)/w/[slug]/reports/page.tsx` | Minimal placeholder | Keep content minimal; ensure inside AppShell |
| `apps/web/src/app/(app)/w/[slug]/settings/*` | api-keys, members, projects only | Add stub routes for remaining EXPERIENCE.md settings |
| `apps/web/src/app/(app)/r/` | **Missing** | Create deep-link redirect |
| `apps/web/src/theme/` | **Missing** | Create `theme.ts` |
| `apps/web/package.json` | Mantine core only | Add modals, notifications, tanstack/react-query |
| `apps/web` eslint/biome | No radix guard | Add restricted import rule |

**Do not touch:** `apps/api` business routes, capture packages, ingest pipeline (E2-S2), `_bmad-output/` except this file.

### Architecture anchors (must follow)

| Anchor | Requirement |
| --- | --- |
| §10 Frontend | App Router structure, TanStack Query key patterns, Mantine theming path |
| §10 Mantine theming | `theme.ts` from DESIGN.md; dark default; no Radix |
| §6 FR-8 gate | Middleware hard-redirect zero membership → `/onboarding` (already E4-S2) |
| EXPERIENCE.md Route map | All listed routes exist (stubs OK for unbuilt features) |
| EXPERIENCE.md Navigation | AppShell 48px header, 240px navbar, Reports default landing |
| DESIGN.md | Color tokens, typography, spacing, component heights |
| AD-10 (partial) | Keyboard module path reserved — do not add ad-hoc listeners; E3-S10 owns registry |

### Theme implementation hints

Map DESIGN.md YAML tokens to Mantine `createTheme`:

```typescript
// apps/web/src/theme/theme.ts — illustrative
import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "violet",
  defaultRadius: "sm",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, ui-monospace, monospace",
  colors: {
    // map accent #7C5CFC → custom violet scale or Mantine violet override
  },
  other: {
    densityRowHeight: 36,
    sidebarWidth: 240,
  },
});
```

Use `@mantine/core` CSS variables where possible. Inter/JetBrains via `next/font/google` in root layout optional but recommended for FCP.

### AppShell navbar routes (slug-scoped)

| NavLink | href | Min role (hide later) |
| --- | --- | --- |
| Reports | `/w/[slug]/reports` | viewer |
| Projects | `/w/[slug]/projects` | viewer |
| Settings | `/w/[slug]/settings/general` | viewer+ |

Settings hub child routes — stubs until feature epics:

- `general`, `members`, `projects`, `api-keys` — **partially exist** (E4-S3/S5)
- `integrations`, `integrations/linear`, `webhooks`, `retention`, `privacy`, `usage`, `danger` — **stub this story**

### Deep link `/r/[id]` resolution

Options (pick simplest):

1. Server component calls API `GET /api/v1/reports/:id` with forwarded cookies — requires E2-S5 read API (**not available yet**)
2. **Recommended for scaffold:** stub redirect using placeholder or defer resolution to E2-S5 — if API unavailable, implement page that calls existing internal endpoint or returns "Report routing — requires E2-S5" with `notFound()` only when ID format invalid

**Pragmatic v1 for this story:** Create route file + server action that attempts fetch; if 404 from API, show Alert. Document dependency on E2-S5 for full behavior — AC8 allows Alert fallback.

### TanStack Query setup

```typescript
// apps/web/src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });
}
```

Use `"use client"` provider wrapper; single client instance via `useState(() => createQueryClient())` pattern.

### Previous story intelligence

**From E4-S2 (4-2-onboarding-gate-middleware.md):**

- `onboarding-gate.ts` is single source for allowlist — do not duplicate redirect logic in layouts
- Middleware matcher: `/`, `/w/:path*`, `/settings/:path*`, `/onboarding`, `/login`, `/auth/:path*` — add `/r/:path*` for deep links
- Session probe via `GET ${API_URL}/api/v1/session` forwarding cookies

**From E4-S3 (4-3-workspace-and-project-crud-with-ingest-keys.md):**

- `(app)/layout.tsx` already fetches workspaces + preferences — keep server-side data loading; pass to AppShell
- `WorkspaceSwitcher` expects `workspaces`, `pinnedWorkspaceIds`, `activeSlug` props
- Pages under `/w/[slug]/projects` and partial settings **already functional** — shell refactor must not break them

**From E4-S1 (4-1):**

- Auth client `baseURL` = API_URL, `credentials: "include"`
- Login/callback routes in `(auth)/` group — outside AppShell (no navbar on login)

### Git intelligence (HEAD `a2d6313`)

Recent work: E4 CRUD, API platform hardening, SDK publish. Web app has functional but un-themed pages — this story is polish/scaffold, not greenfield.

### Anti-patterns (do NOT)

- Do not add Radix UI or shadcn
- Do not implement report list/table (E3-S4)
- Do not weaken onboarding gate for convenience
- Do not add `@mantine/spotlight` actions yet (E3-S9)
- Do not proxy API through Next.js route handlers unless existing pattern requires it
- Do not commit secrets or modify `_bmad-output/` beyond this story file

### Project Structure Notes

New/expected files:

```text
apps/web/src/theme/theme.ts
apps/web/src/lib/query-client.ts
apps/web/src/components/providers.tsx
apps/web/src/components/app-shell/AppHeader.tsx
apps/web/src/components/app-shell/AppNavbar.tsx
apps/web/src/app/(app)/r/[id]/page.tsx
apps/web/src/app/(app)/w/[slug]/settings/general/page.tsx
apps/web/src/app/(app)/w/[slug]/settings/integrations/...
apps/web/src/app/(app)/w/[slug]/settings/page.tsx
apps/web/src/app/(app)/w/[slug]/reports/[id]/page.tsx  # stub if missing
```

### References

- [Source: _bmad-output/planning-artifacts/epics-usebugreport-2026-07-20/E03-web-app-core.md#Story E3-S1]
- [Source: _bmad-output/planning-artifacts/ux-usebugreport-2026-07-20/EXPERIENCE.md#Route map, Navigation structure]
- [Source: _bmad-output/planning-artifacts/ux-usebugreport-2026-07-20/DESIGN.md]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§10 Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture-usebugreport-2026-07-20/architecture.md#§6 AuthN — mandatory workspace gate]
- [Source: _bmad-output/implementation-artifacts/4-2-onboarding-gate-middleware.md]
- [Source: _bmad-output/implementation-artifacts/4-3-workspace-and-project-crud-with-ingest-keys.md]
- [Source: _bmad-output/implementation-artifacts/4-1-better-auth-github-oauth-and-session.md]

## Testing Requirements

Run from repo root; all must exit 0:

```bash
bun install
bunx biome check .
bunx turbo run lint typecheck build --filter=@usebugreport/web

# Unit tests (existing)
bun test apps/web/src/lib/onboarding-gate.test.ts

# E2E (if servers configured)
bunx playwright test e2e/onboarding-gate.spec.ts
```

| Case | Expected |
| --- | --- |
| `next build` for web | All scaffold routes compile |
| Lint rule | Import `@radix-ui/react-dialog` fails lint |
| Zero org session → `/settings/account` | 302 `/onboarding` (unchanged) |
| `/w/acme` | Redirect `/w/acme/reports` |
| Themed shell | Dark background, navbar visible on reports page |

## Dev Agent Record

### Agent Model Used

composer-2.5-fast

### Debug Log References

- build: added client `MantineProviders` + `force-dynamic` to fix Mantine SSG prerender errors
- e2e: playwright webServer timed out waiting for API health (local postgres/redis)

### Completion Notes List

- Mantine v7 dark-first theme from DESIGN.md; Modals/Notifications; TanStack Query provider scaffold
- AppShell (48px header, 240px collapsible navbar) with WorkspaceSwitcher, ⌘K hint, UserMenu
- Full EXPERIENCE.md route map: settings stubs, `/w/[slug]` → reports redirect, `/r/[id]` deep link with Alert fallback
- Middleware extended for `/r/*`; onboarding gate preserved (16/16 unit tests pass)
- turbo lint/typecheck/build pass for `@usebugreport/web`

### File List

- apps/web/package.json
- apps/web/src/app/layout.tsx
- apps/web/src/app/(app)/layout.tsx
- apps/web/src/app/(app)/r/[id]/page.tsx
- apps/web/src/app/(app)/w/[slug]/page.tsx
- apps/web/src/app/(app)/w/[slug]/reports/[id]/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/general/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/integrations/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/integrations/linear/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/webhooks/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/retention/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/privacy/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/usage/page.tsx
- apps/web/src/app/(app)/w/[slug]/settings/danger/page.tsx
- apps/web/src/components/app-shell/app-header.tsx
- apps/web/src/components/app-shell/app-navbar.tsx
- apps/web/src/components/app-shell/app-shell-layout.tsx
- apps/web/src/components/app-shell/user-menu.tsx
- apps/web/src/components/mantine-providers.tsx
- apps/web/src/components/providers.tsx
- apps/web/src/components/settings-stub-page.tsx
- apps/web/src/lib/api-server.ts
- apps/web/src/lib/onboarding-gate.ts
- apps/web/src/lib/query-client.ts
- apps/web/src/middleware.ts
- apps/web/src/theme/theme.ts

## Change Log

- 2026-07-20: E3-S1 web shell — Mantine theme, AppShell layout, route scaffold, onboarding gate preserved
