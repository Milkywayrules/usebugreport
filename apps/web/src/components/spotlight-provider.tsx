"use client";

import { Spotlight } from "@mantine/spotlight";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSpotlightActions } from "@/keyboard/use-register-spotlight-actions";
import { readSpotlightRecent } from "@/keyboard/spotlight-recent";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSpotlightProps {
  activeSlug?: string;
  onOpenShortcuts?: () => void;
  workspaces: WorkspaceRow[];
}

type SpotlightMode = "root" | "switch";

export function WorkspaceSpotlight({
  activeSlug,
  onOpenShortcuts,
  workspaces,
}: WorkspaceSpotlightProps) {
  const [mode, setMode] = useState<SpotlightMode>("root");
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchHits([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${apiUrl}/api/v1/reports/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            return [];
          }
          const body = (await response.json()) as {
            data?: Array<{ id: string; title: string }>;
          };
          return body.data ?? [];
        })
        .then((rows) => setSearchHits(rows))
        .catch(() => undefined);
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const handleClose = useCallback(() => {
    setMode("root");
    setQuery("");
    setSearchHits([]);
  }, []);

  const enterSwitchMode = useCallback(() => {
    setMode("switch");
  }, []);

  const baseActions = useRegisterSpotlightActions({
    activeSlug,
    mode,
    onEnterSwitchMode: enterSwitchMode,
    onOpenShortcuts,
    query,
    searchHits,
    workspaces,
  });

  const actions = useMemo(() => {
    if (query.trim() || mode === "switch") {
      return baseActions;
    }

    const recent = readSpotlightRecent();
    if (recent.length === 0) {
      return baseActions;
    }

    const byId = new Map(baseActions.map((action) => [action.id, action]));
    const recentActions = recent
      .map((entry) => byId.get(entry.actionId))
      .filter((action): action is NonNullable<typeof action> => Boolean(action));

    if (recentActions.length === 0) {
      return baseActions;
    }

    return [
      ...recentActions.map((action) => ({
        ...action,
        group: "Recent",
      })),
      ...baseActions,
    ];
  }, [baseActions, mode, query]);

  if (!mounted) {
    return null;
  }

  return (
    <Spotlight
      key={mode}
      actions={actions}
      closeOnActionTrigger={mode === "switch"}
      highlightQuery
      limit={mode === "switch" ? 12 : 12}
      maxHeight={460}
      nothingFound="Nothing found..."
      onQueryChange={setQuery}
      onSpotlightClose={handleClose}
      query={query}
      scrollable
      searchProps={{
        placeholder:
          mode === "switch" ? "Search workspaces…" : "Search commands…",
      }}
      shortcut="mod + K"
    />
  );
}
