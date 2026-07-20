"use client";

import { useHotkeys, type HotkeyItem } from "@mantine/hooks";
import { useMemo } from "react";
import { useWorkspaceSwitch } from "@/components/workspace-switch-context";
import { isEditableTarget } from "@/keyboard/is-editable-target";
import {
  WORKSPACE_PIN_SHORTCUTS,
  type WorkspacePinSlot,
} from "@/keyboard/shortcuts";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface UseWorkspacePinHotkeysOptions {
  activeSlug?: string;
  pinnedWorkspaceIds: string[];
  workspaces: WorkspaceRow[];
}

export function useWorkspacePinHotkeys({
  activeSlug,
  pinnedWorkspaceIds,
  workspaces,
}: UseWorkspacePinHotkeysOptions): void {
  const { switchWorkspace } = useWorkspaceSwitch();

  const workspaceById = useMemo(
    () => new Map(workspaces.map((row) => [row.id, row])),
    [workspaces]
  );

  const hotkeys = useMemo(
    () =>
      (
        Object.entries(WORKSPACE_PIN_SHORTCUTS) as [
          `${WorkspacePinSlot}`,
          (typeof WORKSPACE_PIN_SHORTCUTS)[WorkspacePinSlot],
        ][]
      ).map(([slotKey, shortcut]) => {
        const slotIndex = Number(slotKey) - 1;
        return [
          shortcut.keys,
          (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) {
              return;
            }

            const organizationId = pinnedWorkspaceIds[slotIndex];
            if (!organizationId) {
              return;
            }

            const workspace = workspaceById.get(organizationId);
            if (!workspace || workspace.slug === activeSlug) {
              return;
            }

            switchWorkspace(workspace).catch(() => undefined);
          },
        ] satisfies HotkeyItem;
      }),
    [activeSlug, pinnedWorkspaceIds, switchWorkspace, workspaceById]
  );

  useHotkeys(hotkeys);
}
