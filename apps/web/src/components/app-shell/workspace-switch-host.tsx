"use client";

import { useWorkspacePinHotkeys } from "@/keyboard/use-workspace-pin-hotkeys";
import { WorkspaceSpotlight } from "@/components/spotlight-provider";
import { SpotlightCommandProvider } from "@/keyboard/spotlight-command-context";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSwitchHostProps {
  activeSlug?: string;
  children: React.ReactNode;
  pinnedWorkspaceIds: string[];
  workspaces: WorkspaceRow[];
}

export function WorkspaceSwitchHost({
  activeSlug,
  children,
  pinnedWorkspaceIds,
  workspaces,
}: WorkspaceSwitchHostProps) {
  useWorkspacePinHotkeys({ activeSlug, pinnedWorkspaceIds, workspaces });

  return (
    <SpotlightCommandProvider>
      <WorkspaceSpotlight
        activeSlug={activeSlug}
        onOpenShortcuts={() => {
          window.dispatchEvent(new Event("ubr:open-shortcuts"));
        }}
        workspaces={workspaces}
      />
      {children}
    </SpotlightCommandProvider>
  );
}
