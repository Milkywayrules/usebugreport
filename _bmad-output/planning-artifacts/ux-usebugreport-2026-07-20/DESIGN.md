---
name: usebugreport
description: Bug-reporting OS for AI-augmented builders. Mantine v7+ on Next.js App Router; dark-mode-first dev-tool aesthetic with Linear-grade density.
status: final
updated: 2026-07-20
sources:
  - {planning_artifacts}/prds/prd-usebugreport-2026-07-20/prd.md
  - {planning_artifacts}/prds/prd-usebugreport-2026-07-20/addendum.md
  - {planning_artifacts}/briefs/brief-usebugreport-2026-07-20/brief.md
colors:
  # Surfaces — dark default (dev-tool)
  surface-base: '#0C0C0E'
  surface-raised: '#141417'
  surface-overlay: '#1A1A1F'
  surface-sunken: '#08080A'
  # Text
  text-primary: '#EDEDEF'
  text-secondary: '#8B8B96'
  text-tertiary: '#5C5C66'
  text-inverse: '#0C0C0E'
  # Brand accent — single chromatic anchor (Linear-violet family, tuned for bug/triage)
  accent: '#7C5CFC'
  accent-hover: '#9178FF'
  accent-muted: '#7C5CFC26'
  accent-foreground: '#FFFFFF'
  # Semantic — report status (used ONLY for status badges/pills, never chrome)
  status-open: '#5C8AC2'
  status-in-progress: '#F59E0B'
  status-resolved: '#22C55E'
  status-closed: '#6B7280'
  status-duplicate: '#A78BFA'
  # Feedback
  destructive: '#EF4444'
  destructive-muted: '#EF444426'
  success: '#22C55E'
  warning: '#F59E0B'
  info: '#3B82F6'
  # Borders & focus
  border-subtle: '#FFFFFF0F'
  border-default: '#FFFFFF1A'
  border-strong: '#FFFFFF33'
  focus-ring: '#7C5CFC'
  # Light mode overrides (prefers-color-scheme or user toggle)
  surface-base-light: '#FAFAFA'
  surface-raised-light: '#FFFFFF'
  surface-overlay-light: '#F4F4F5'
  surface-sunken-light: '#F0F0F2'
  text-primary-light: '#18181B'
  text-secondary-light: '#71717A'
  text-tertiary-light: '#A1A1AA'
  border-subtle-light: '#0000000A'
  border-default-light: '#00000014'
  border-strong-light: '#00000026'
typography:
  # Mantine default stack — Inter via next/font; monospace for logs/code
  font-family:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  font-family-mono:
    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace'
  text-xs:
    fontSize: 11px
    lineHeight: '16px'
    fontWeight: '400'
  text-sm:
    fontSize: 13px
    lineHeight: '18px'
    fontWeight: '400'
  text-md:
    fontSize: 14px
    lineHeight: '20px'
    fontWeight: '400'
  text-lg:
    fontSize: 16px
    lineHeight: '24px'
    fontWeight: '500'
  heading-sm:
    fontSize: 14px
    lineHeight: '20px'
    fontWeight: '600'
    letterSpacing: -0.01em
  heading-md:
    fontSize: 18px
    lineHeight: '24px'
    fontWeight: '600'
    letterSpacing: -0.02em
  heading-lg:
    fontSize: 22px
    lineHeight: '28px'
    fontWeight: '600'
    letterSpacing: -0.02em
rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  density-row-height: 36px
  density-row-height-compact: 32px
  sidebar-width: 240px
  sidebar-collapsed-width: 52px
  detail-panel-min: 320px
  filter-bar-height: 40px
components:
  app-shell-header:
    height: 48px
    background: '{colors.surface-raised}'
    borderBottom: '1px solid {colors.border-subtle}'
  report-row:
    height: '{spacing.density-row-height}'
    paddingX: '{spacing.3}'
    fontSize: '{typography.text-sm.fontSize}'
    hoverBackground: '{colors.surface-overlay}'
    selectedBackground: '{colors.accent-muted}'
    borderRadius: '{rounded.sm}'
  status-badge-open:
    background: '{colors.status-open}26'
    color: '{colors.status-open}'
    radius: '{rounded.full}'
  status-badge-in-progress:
    background: '{colors.status-in-progress}26'
    color: '{colors.status-in-progress}'
    radius: '{rounded.full}'
  status-badge-resolved:
    background: '{colors.status-resolved}26'
    color: '{colors.status-resolved}'
    radius: '{rounded.full}'
  status-badge-closed:
    background: '{colors.status-closed}26'
    color: '{colors.status-closed}'
    radius: '{rounded.full}'
  status-badge-duplicate:
    background: '{colors.status-duplicate}26'
    color: '{colors.status-duplicate}'
    radius: '{rounded.full}'
  button-primary:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    hoverBackground: '{colors.accent-hover}'
    radius: '{rounded.md}'
  spotlight-result-active:
    background: '{colors.accent-muted}'
    borderLeft: '2px solid {colors.accent}'
  filter-chip:
    height: 28px
    radius: '{rounded.full}'
    background: '{colors.surface-overlay}'
    border: '1px solid {colors.border-default}'
  usage-meter-track:
    height: 6px
    radius: '{rounded.full}'
    background: '{colors.surface-overlay}'
  usage-meter-fill:
    background: '{colors.accent}'
    warningThreshold: '{colors.warning}'
    dangerThreshold: '{colors.destructive}'
  console-log-error:
    color: '{colors.destructive}'
  console-log-warn:
    color: '{colors.warning}'
  network-status-4xx:
    color: '{colors.warning}'
  network-status-5xx:
    color: '{colors.destructive}'
---

## Brand & Style

usebugreport is a **dev-tool for bug triage** — not a consumer app, not a support suite. The visual posture mirrors the tools its users already live in: Linear, Cursor, GitHub, Vercel dashboard. Dark mode is the default because the primary audience triages bugs at night, in IDE-adjacent workflows, and on staging environments with dark themes.

The brand expression is **restraint + density**: small type (13px body), tight row heights (36px), minimal chrome, one accent color (`{colors.accent}`) for primary actions and keyboard focus, and a dedicated status-color vocabulary that never bleeds into navigation or marketing surfaces. Whitespace is scarce by design — every pixel earns its place in the report queue.

Mantine v7+ is the component library. This DESIGN.md specifies the **Mantine theme delta** (CSS variables via `createTheme`, `MantineProvider`, `ColorSchemeScript` defaulting to dark). Unlisted Mantine defaults apply. **Never Radix UI.** If a headless primitive is genuinely missing, use `@base-ui-components/react` — but prefer Mantine-native (`Spotlight`, `AppShell`, `Tabs`, `Modal`, `Drawer`, `Menu`, `Badge`, `ScrollArea`, `Code`, `Skeleton`, `Notification`, `Progress`, `Checkbox`, `TextInput`, `Select`, `MultiSelect`, `ActionIcon`, `Tooltip`, `Breadcrumbs`, `NavLink`, `Divider`, `Paper`, `Group`, `Stack`, `Flex`, `Box`, `Text`, `Title`, `Anchor`, `CopyButton`, `PasswordInput`, `Switch`, `Slider`, `DatePickerInput` from `@mantine/dates`).

## Colors

### Surfaces (dark default)

- **`{colors.surface-base}`** — App background. `AppShell` main area, replay viewer canvas backdrop.
- **`{colors.surface-raised}`** — Header, sidebar, filter bar, card panels. One step above base.
- **`{colors.surface-overlay}`** — Hover states, dropdown menus, Spotlight results, modal backgrounds.
- **`{colors.surface-sunken}`** — Console log panel, network table, code blocks — "terminal inset."

### Text

- **`{colors.text-primary}`** — Report titles, primary labels, active nav.
- **`{colors.text-secondary}`** — Metadata (age, reporter, project name), table secondary columns.
- **`{colors.text-tertiary}`** — Placeholders, disabled, keyboard shortcut hints in palette footer.

### Accent

- **`{colors.accent}`** — Primary buttons, active workspace indicator, keyboard focus ring, selected filter chip border, usage meter fill (healthy). Used for *action*, not decoration.
- **`{colors.accent-muted}`** — Selected report row background, Spotlight highlighted result.

### Status colors (report lifecycle ONLY)

Each status maps to a `{components.status-badge-*}` token. Badges use 15% opacity background + full-opacity text. Never use status colors for buttons, links, or nav.

| Status | Token | Hex |
|--------|-------|-----|
| open | `{colors.status-open}` | `#5C8AC2` |
| in_progress | `{colors.status-in-progress}` | `#F59E0B` |
| resolved | `{colors.status-resolved}` | `#22C55E` |
| closed | `{colors.status-closed}` | `#6B7280` |
| duplicate | `{colors.status-duplicate}` | `#A78BFA` |

### Light mode

Light tokens (`*-light` suffix) swap via Mantine `colorScheme` toggle in user settings. Same hierarchy; borders darken instead of lighten. Status and accent colors unchanged.

## Typography

- **Body default:** `{typography.text-sm}` (13px) — report list, console logs, network table, settings forms. Density requires sub-14px body; Mantine `fontSizes.sm` overridden to 13px.
- **Metadata / timestamps:** `{typography.text-xs}` (11px), `{colors.text-secondary}`.
- **Section headings:** `{typography.heading-sm}` (14px semibold) — panel titles ("Console", "Network", settings sections).
- **Page titles:** `{typography.heading-md}` (18px) — report detail title, settings page headers.
- **Empty states:** `{typography.heading-md}` headline + `{typography.text-sm}` body; no display-serif — this is a tool.
- **Monospace:** `{typography.font-family-mono}` — console output, network URLs, SDK snippet, API keys (masked), ingest keys, webhook signatures.

Mantine `Title` order mapping: `order={3}` → heading-md, `order={5}` → heading-sm.

## Layout & Spacing

### Density contract

- Report list row height: `{spacing.density-row-height}` (36px). Compact mode (user pref): `{spacing.density-row-height-compact}` (32px).
- Table cell padding: `{spacing.2}` horizontal, `{spacing.1}` vertical.
- Filter bar: `{spacing.filter-bar-height}` fixed; sits below header, above list.
- Sidebar: `{spacing.sidebar-width}` expanded; `{spacing.sidebar-collapsed-width}` icon-only on `< lg`.
- Content max-width: none on list (full bleed); report detail splits 60/40 (replay left, panels right) on `≥ xl`; stacks on `< xl`.

### Grid (report detail)

```
┌─────────────────────────────────────────────────────────────┐
│ AppShell.Header (48px) — workspace switcher, ⌘K, avatar    │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │  Breadcrumbs + title + status + actions          │
│ 240px    ├───────────────────────────┬──────────────────────┤
│          │  Replay viewer (flex 3)   │  Tabs panel (flex 2) │
│          │  rrweb-player             │  Console / Network / │
│          │                           │  Metadata / Comments │
└──────────┴───────────────────────────┴──────────────────────┘
```

### Mantine theme density

Set `spacing.xs` through `spacing.xl` to the 4-based scale in frontmatter. Override component defaults:

```typescript
// theme override sketch — implementation reference
createTheme({
  fontSizes: { xs: '11px', sm: '13px', md: '14px', lg: '16px' },
  spacing: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  defaultRadius: 'sm',
  primaryColor: 'violet', // mapped to accent CSS vars
  components: {
    Table: { defaultProps: { verticalSpacing: 'xs', horizontalSpacing: 'sm' } },
    Button: { defaultProps: { size: 'xs' } },
    Badge: { defaultProps: { size: 'sm', variant: 'light' } },
    TextInput: { defaultProps: { size: 'xs' } },
    Select: { defaultProps: { size: 'xs' } },
  },
});
```

## Elevation & Depth

Minimal shadow language — dev tools use borders, not drop shadows.

- **Level 0:** `{colors.surface-base}` — flat content.
- **Level 1:** `1px {colors.border-subtle}` border on `{colors.surface-raised}` — cards, sidebar, header. No box-shadow.
- **Level 2:** `{colors.surface-overlay}` + `{colors.border-default}` — dropdowns, Spotlight, popovers. Mantine `shadow="md"` allowed only on modals.
- **Modals / drawers:** Mantine `Modal` / `Drawer` with `shadow="xl"`, overlay `backgroundOpacity={0.55}`.

Replay viewer gets a subtle `{colors.border-default}` frame; no shadow.

## Shapes

- **Default radius:** `{rounded.sm}` (4px) — inputs, buttons, table rows on hover.
- **Cards / panels:** `{rounded.md}` (6px).
- **Modals / Spotlight:** `{rounded.lg}` (8px).
- **Status badges / filter chips:** `{rounded.full}`.
- **Avatar:** `{rounded.full}`.

Avoid `{rounded.xl}` except onboarding hero card.

## Components

### Inherited from Mantine (minimal override)

`Button`, `Modal`, `Drawer`, `Menu`, `Popover`, `Tooltip`, `Notification`, `Skeleton`, `Loader`, `Checkbox`, `Switch`, `CopyButton`, `PasswordInput`, `ScrollArea`, `Divider`, `Paper`, `Anchor`. Contract: use `size="xs"` or `size="sm"` defaults globally.

### Brand-layer components

| Component | Mantine base | Visual spec |
|-----------|--------------|-------------|
| **Report row** | Custom + TanStack Table row | `{components.report-row}`. Columns: checkbox, status dot, title (truncate), project, reporter, age, Linear link icon. Hover: `{colors.surface-overlay}`. Selected: `{colors.accent-muted}`. Focused (keyboard): left `2px {colors.focus-ring}` border. |
| **Status badge** | `Badge variant="light"` | Per-status `{components.status-badge-*}`. Text: status label capitalized. Size `sm`. |
| **Workspace switcher** | `Menu` + `Button variant="subtle"` | Trigger shows active workspace name + chevron. Menu lists pinned (⌘1–9 hint) then all. Active row: `{colors.accent-muted}`. |
| **Command palette** | `@mantine/spotlight` | `{components.spotlight-result-active}` for highlighted action. Footer bar: `{colors.text-tertiary}` shortcut hints. Max height 420px. |
| **Filter chip** | `Chip` or `Badge` interactive | `{components.filter-chip}`. Active filter: `{colors.accent}` border. |
| **Bulk action bar** | `Affix` bottom or inline `Group` | Appears when ≥1 row selected. `{colors.surface-raised}` background, top border. Primary actions: status `Menu`, "Push to Linear" `Button`. |
| **Replay viewer** | Custom wrapper + `rrweb-player` | `{colors.surface-sunken}` background. Controls bar: `{colors.surface-raised}`, `{rounded.md}`. Play/pause, timeline scrub, speed 1x/2x. |
| **Console panel** | `ScrollArea` + `Code block` | `{colors.surface-sunken}`. Level icons colored per log level. `{components.console-log-error}`, `{components.console-log-warn}`. |
| **Network panel** | `Table` compact | Method, status (colored `{components.network-status-*}`), host, path, duration. Expand row for headers (redacted). |
| **Usage meter** | `Progress` + `Text` | `{components.usage-meter-track}` / `{components.usage-meter-fill}`. Label: "847 / 2,000 reports this month". Warning at 80%: `{colors.warning}`. At cap: `{colors.destructive}`. |
| **SDK snippet block** | `Code` + `CopyButton` | `{colors.surface-sunken}`, monospace, `{rounded.md}`. Highlight `{colors.accent}` on key token. |
| **Empty state** | `Stack` centered | `{typography.heading-md}` + `{typography.text-sm}` + single `Button`. No illustration in v1 — icon optional (`IconBug`). |
| **Linear link indicator** | `ThemeIcon` size xs | Linear logo monochrome; filled when linked, dim when not. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Dark mode default; respect system pref as initial only | Light-mode-first or marketing-gradient hero surfaces |
| 13px body, 36px rows — Linear density | 16px body with generous padding (consumer spacing) |
| `{colors.accent}` for actions and keyboard focus | Accent on status badges or decorative chrome |
| Status colors exclusively on report lifecycle badges | Rainbow nav or multi-color sidebar |
| Mantine components + CSS variables | Radix UI in any form |
| `@mantine/spotlight` for ⌘K | Custom command palette from scratch |
| `useHotkeys` from `@mantine/hooks` | Global untracked key listeners |
| Borders for elevation | Heavy drop shadows on list rows |
| Monospace for logs, keys, snippets | Proportional font in console output |
| `size="xs"` / `size="sm"` globally | Default Mantine `md` sizing (too large) |
