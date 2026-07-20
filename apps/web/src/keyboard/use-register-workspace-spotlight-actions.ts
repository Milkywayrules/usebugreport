"use client";

import type { SpotlightActionData } from "@mantine/spotlight";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useWorkspaceSwitch } from "@/components/workspace-switch-context";
import { WORKSPACE_SPOTLIGHT_ACTIONS } from "@/keyboard/shortcuts";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface UseRegisterWorkspaceSpotlightActionsInput {
  activeSlug?: string;
  mode: "root" | "switch";
  onEnterSwitchMode: () => void;
  workspaces: WorkspaceRow[];
}

export function useRegisterWorkspaceSpotlightActions({
  activeSlug,
  mode,
  onEnterSwitchMode,
  workspaces,
}: UseRegisterWorkspaceSpotlightActionsInput): SpotlightActionData[] {
  const router = useRouter();
  const { switchWorkspace } = useWorkspaceSwitch();

  return useMemo(() => {
    if (mode === "switch") {
      return workspaces.map((workspace) => ({
        description: workspace.slug,
        id: `ws.switch.${workspace.id}`,
        keywords: [workspace.name, workspace.slug],
        label: workspace.name,
        onClick: () => {
          if (workspace.slug !== activeSlug) {
            switchWorkspace(workspace).catch(() => undefined);
          }
        },
      }));
    }

    return [
      {
        closeSpotlightOnTrigger: false,
        description: "Fuzzy search all memberships",
        id: WORKSPACE_SPOTLIGHT_ACTIONS.switch.id,
        label: WORKSPACE_SPOTLIGHT_ACTIONS.switch.label,
        onClick: onEnterSwitchMode,
      },
      {
        id: WORKSPACE_SPOTLIGHT_ACTIONS.pinManage.id,
        label: WORKSPACE_SPOTLIGHT_ACTIONS.pinManage.label,
        onClick: () => {
          router.push("/settings/workspaces");
        },
      },
      {
        id: WORKSPACE_SPOTLIGHT_ACTIONS.create.id,
        label: WORKSPACE_SPOTLIGHT_ACTIONS.create.label,
        onClick: () => {
          router.push("/settings/workspaces?create=1");
        },
      },
    ];
  }, [
    activeSlug,
    mode,
    onEnterSwitchMode,
    router,
    switchWorkspace,
    workspaces,
  ]);
}
