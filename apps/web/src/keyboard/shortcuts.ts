/** Central keyboard shortcut registry (AD-10). */
export type ShortcutGroup =
  | "Global"
  | "Navigation"
  | "Report list"
  | "Report detail"
  | "Replay viewer"
  | "Workspace";

export interface ShortcutDefinition {
  allowInEditable?: boolean;
  group: ShortcutGroup;
  id: string;
  keys: string;
  label: string;
}

export const WORKSPACE_PIN_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type WorkspacePinSlot = (typeof WORKSPACE_PIN_SLOTS)[number];

export const WORKSPACE_PIN_SHORTCUTS: Record<
  WorkspacePinSlot,
  ShortcutDefinition
> = {
  1: {
    id: "ws.pin.1",
    keys: "mod+1",
    label: "Switch to pinned workspace 1",
    group: "Workspace",
  },
  2: {
    id: "ws.pin.2",
    keys: "mod+2",
    label: "Switch to pinned workspace 2",
    group: "Workspace",
  },
  3: {
    id: "ws.pin.3",
    keys: "mod+3",
    label: "Switch to pinned workspace 3",
    group: "Workspace",
  },
  4: {
    id: "ws.pin.4",
    keys: "mod+4",
    label: "Switch to pinned workspace 4",
    group: "Workspace",
  },
  5: {
    id: "ws.pin.5",
    keys: "mod+5",
    label: "Switch to pinned workspace 5",
    group: "Workspace",
  },
  6: {
    id: "ws.pin.6",
    keys: "mod+6",
    label: "Switch to pinned workspace 6",
    group: "Workspace",
  },
  7: {
    id: "ws.pin.7",
    keys: "mod+7",
    label: "Switch to pinned workspace 7",
    group: "Workspace",
  },
  8: {
    id: "ws.pin.8",
    keys: "mod+8",
    label: "Switch to pinned workspace 8",
    group: "Workspace",
  },
  9: {
    id: "ws.pin.9",
    keys: "mod+9",
    label: "Switch to pinned workspace 9",
    group: "Workspace",
  },
};

export const WORKSPACE_SPOTLIGHT_ACTIONS = {
  create: { id: "ws.create", label: "Create workspace" },
  pinManage: { id: "ws.pin-manage", label: "Manage pinned workspaces" },
  switch: { id: "ws.switch", label: "Switch workspace…" },
} as const;

export const GLOBAL_SHORTCUTS = {
  palette: {
    id: "global.palette",
    keys: "mod+K",
    label: "Open command palette",
    group: "Global",
  },
  help: {
    id: "global.help",
    keys: "?",
    label: "Open keyboard shortcuts reference",
    group: "Global",
  },
  escape: {
    id: "global.escape",
    keys: "escape",
    label: "Close overlay or clear bulk selection",
    group: "Global",
  },
} as const satisfies Record<string, ShortcutDefinition>;

export const NAVIGATION_SHORTCUTS = {
  goReports: {
    id: "nav.reports",
    keys: "g r",
    label: "Go to Reports",
    group: "Navigation",
  },
  goProjects: {
    id: "nav.projects",
    keys: "g p",
    label: "Go to Projects",
    group: "Navigation",
  },
  goSettings: {
    id: "nav.settings",
    keys: "g s",
    label: "Go to Settings",
    group: "Navigation",
  },
  goIntegrations: {
    id: "nav.integrations",
    keys: "g i",
    label: "Go to Integrations",
    group: "Navigation",
  },
} as const satisfies Record<string, ShortcutDefinition>;

export const REPORT_LIST_SHORTCUTS = {
  focusNext: {
    id: "list.focus-next",
    keys: "j",
    label: "Move focus to next row",
    group: "Report list",
  },
  focusNextAlt: {
    id: "list.focus-next-alt",
    keys: "down",
    label: "Move focus to next row",
    group: "Report list",
  },
  focusPrev: {
    id: "list.focus-prev",
    keys: "k",
    label: "Move focus to previous row",
    group: "Report list",
  },
  focusPrevAlt: {
    id: "list.focus-prev-alt",
    keys: "up",
    label: "Move focus to previous row",
    group: "Report list",
  },
  toggleSelect: {
    id: "list.toggle-select",
    keys: "x",
    label: "Toggle select on focused row",
    group: "Report list",
  },
  selectAllVisible: {
    id: "list.select-all",
    keys: "shift+X",
    label: "Select all visible rows",
    group: "Report list",
  },
  openDetail: {
    id: "list.open",
    keys: "enter",
    label: "Open focused report",
    group: "Report list",
  },
  openNewTab: {
    id: "list.open-tab",
    keys: "o",
    label: "Open focused report in new tab",
    group: "Report list",
  },
  focusSearch: {
    id: "list.search",
    keys: "/",
    label: "Focus filter search",
    group: "Report list",
    allowInEditable: true,
  },
  filterPopover: {
    id: "list.filter",
    keys: "f",
    label: "Open filter popover",
    group: "Report list",
  },
  statusOpen: {
    id: "list.status.open",
    keys: "1",
    label: "Set status → open",
    group: "Report list",
  },
  statusInProgress: {
    id: "list.status.in_progress",
    keys: "2",
    label: "Set status → in progress",
    group: "Report list",
  },
  statusResolved: {
    id: "list.status.resolved",
    keys: "3",
    label: "Set status → resolved",
    group: "Report list",
  },
  statusClosed: {
    id: "list.status.closed",
    keys: "4",
    label: "Set status → closed",
    group: "Report list",
  },
  statusDuplicate: {
    id: "list.status.duplicate",
    keys: "5",
    label: "Set status → duplicate",
    group: "Report list",
  },
} as const satisfies Record<string, ShortcutDefinition>;

export const REPORT_DETAIL_SHORTCUTS = {
  back: {
    id: "detail.back",
    keys: "b",
    label: "Back to list",
    group: "Report detail",
  },
  backspace: {
    id: "detail.back-alt",
    keys: "backspace",
    label: "Back to list",
    group: "Report detail",
  },
  copyUrl: {
    id: "detail.copy-url",
    keys: "l",
    label: "Copy report URL",
    group: "Report detail",
  },
} as const satisfies Record<string, ShortcutDefinition>;

export const REPLAY_SHORTCUTS = {
  playPause: {
    id: "replay.play-pause",
    keys: "space",
    label: "Play or pause replay",
    group: "Replay viewer",
  },
  scrubForward: {
    id: "replay.scrub-forward",
    keys: "right",
    label: "Scrub forward 5s",
    group: "Replay viewer",
  },
  scrubBack: {
    id: "replay.scrub-back",
    keys: "left",
    label: "Scrub back 5s",
    group: "Replay viewer",
  },
} as const satisfies Record<string, ShortcutDefinition>;

/** Flat registry for palette + help modal (deduped by id). */
export const SHORTCUTS: ShortcutDefinition[] = [
  ...Object.values(GLOBAL_SHORTCUTS),
  ...Object.values(NAVIGATION_SHORTCUTS),
  ...Object.values(REPORT_LIST_SHORTCUTS),
  ...Object.values(REPORT_DETAIL_SHORTCUTS),
  ...Object.values(REPLAY_SHORTCUTS),
  ...Object.values(WORKSPACE_PIN_SHORTCUTS),
];

export const SHORTCUTS_BY_ID = Object.fromEntries(
  SHORTCUTS.map((shortcut) => [shortcut.id, shortcut])
) as Record<string, ShortcutDefinition>;

export const REPORT_LIST_STATUS_BY_KEY: Record<
  string,
  (typeof REPORT_LIST_SHORTCUTS)[keyof typeof REPORT_LIST_SHORTCUTS]
> = {
  "1": REPORT_LIST_SHORTCUTS.statusOpen,
  "2": REPORT_LIST_SHORTCUTS.statusInProgress,
  "3": REPORT_LIST_SHORTCUTS.statusResolved,
  "4": REPORT_LIST_SHORTCUTS.statusClosed,
  "5": REPORT_LIST_SHORTCUTS.statusDuplicate,
};

export function getModifierPrefix(isMac: boolean): string {
  return isMac ? "⌘" : "Ctrl+";
}

export function formatPinSlotHint(
  slot: WorkspacePinSlot,
  isMac: boolean
): string {
  return `${getModifierPrefix(isMac)}${slot}`;
}

export function formatShortcutKeys(keys: string, isMac: boolean): string {
  if (keys.includes("mod+")) {
    return keys.replace(/mod\+/g, getModifierPrefix(isMac));
  }
  return keys;
}

export function groupShortcutsForModal(): Array<{
  group: ShortcutGroup;
  items: ShortcutDefinition[];
}> {
  const groups = new Map<ShortcutGroup, ShortcutDefinition[]>();
  const seen = new Set<string>();
  for (const shortcut of SHORTCUTS) {
    if (seen.has(shortcut.id)) {
      continue;
    }
    seen.add(shortcut.id);
    const bucket = groups.get(shortcut.group) ?? [];
    bucket.push(shortcut);
    groups.set(shortcut.group, bucket);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}
