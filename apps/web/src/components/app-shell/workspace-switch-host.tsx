"use client";

import { useWorkspacePinHotkeys } from "@/keyboard/use-workspace-pin-hotkeys";
import { WorkspaceSpotlight } from "@/components/spotlight-provider";

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
    <>
      <WorkspaceSpotlight activeSlug={activeSlug} workspaces={workspaces} />
      {children}
    </>
  );
}
