"use client";

import { Spotlight } from "@mantine/spotlight";
import { useCallback, useEffect, useState } from "react";
import { useRegisterWorkspaceSpotlightActions } from "@/keyboard/use-register-workspace-spotlight-actions";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSpotlightProps {
  activeSlug?: string;
  workspaces: WorkspaceRow[];
}

type SpotlightMode = "root" | "switch";

export function WorkspaceSpotlight({
  activeSlug,
  workspaces,
}: WorkspaceSpotlightProps) {
  const [mode, setMode] = useState<SpotlightMode>("root");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    setMode("root");
  }, []);

  const enterSwitchMode = useCallback(() => {
    setMode("switch");
  }, []);

  const actions = useRegisterWorkspaceSpotlightActions({
    activeSlug,
    mode,
    onEnterSwitchMode: enterSwitchMode,
    workspaces,
  });

  if (!mounted) {
    return null;
  }

  return (
    <Spotlight
      key={mode}
      actions={actions}
      closeOnActionTrigger={mode === "switch"}
      highlightQuery
      limit={mode === "switch" ? 12 : 7}
      maxHeight={420}
      nothingFound="Nothing found..."
      onSpotlightClose={handleClose}
      scrollable={mode === "switch"}
      searchProps={{
        placeholder:
          mode === "switch" ? "Search workspaces…" : "Search commands…",
      }}
      shortcut="mod + K"
    />
  );
}
