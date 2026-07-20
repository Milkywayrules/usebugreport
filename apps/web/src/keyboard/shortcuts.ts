/** Workspace pin hotkeys — seed for E3-S10 central registry. */
export const WORKSPACE_PIN_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type WorkspacePinSlot = (typeof WORKSPACE_PIN_SLOTS)[number];

export const WORKSPACE_PIN_SHORTCUTS: Record<
  WorkspacePinSlot,
  { id: string; keys: string; label: string }
> = {
  1: { id: "ws.pin.1", keys: "mod+1", label: "Switch to pinned workspace 1" },
  2: { id: "ws.pin.2", keys: "mod+2", label: "Switch to pinned workspace 2" },
  3: { id: "ws.pin.3", keys: "mod+3", label: "Switch to pinned workspace 3" },
  4: { id: "ws.pin.4", keys: "mod+4", label: "Switch to pinned workspace 4" },
  5: { id: "ws.pin.5", keys: "mod+5", label: "Switch to pinned workspace 5" },
  6: { id: "ws.pin.6", keys: "mod+6", label: "Switch to pinned workspace 6" },
  7: { id: "ws.pin.7", keys: "mod+7", label: "Switch to pinned workspace 7" },
  8: { id: "ws.pin.8", keys: "mod+8", label: "Switch to pinned workspace 8" },
  9: { id: "ws.pin.9", keys: "mod+9", label: "Switch to pinned workspace 9" },
};

export const WORKSPACE_SPOTLIGHT_ACTIONS = {
  create: { id: "ws.create", label: "Create workspace" },
  pinManage: { id: "ws.pin-manage", label: "Manage pinned workspaces" },
  switch: { id: "ws.switch", label: "Switch workspace…" },
} as const;

export function getModifierPrefix(isMac: boolean): string {
  return isMac ? "⌘" : "Ctrl+";
}

export function formatPinSlotHint(
  slot: WorkspacePinSlot,
  isMac: boolean
): string {
  return `${getModifierPrefix(isMac)}${slot}`;
}
