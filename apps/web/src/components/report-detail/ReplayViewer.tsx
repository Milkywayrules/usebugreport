"use client";

import { Alert, Box, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useReplayViewerHotkeys } from "@/keyboard/use-replay-viewer-hotkeys";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";
import {
  fetchReplayManifest,
} from "@/lib/report-detail/client-api";
import { loadReplayEvents } from "@/lib/report-detail/replay-events";

export function ReplayViewer({ reportId }: { reportId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<{ getReplayer: () => { getCurrentTime: () => number; pause: () => void; play: (time?: number) => void; service: { state: { value: string } } } } | null>(null);

  const manifestQuery = useQuery({
    queryFn: () => fetchReplayManifest(reportId),
    queryKey: ["report", reportId, "replay-manifest"],
  });

  const replayActive = Boolean(
    manifestQuery.data && !manifestQuery.data.replayExpired
  );

  useReplayViewerHotkeys({
    active: replayActive,
    containerRef,
    playerRef,
  });

  useEffect(() => {
    if (!containerRef.current || !manifestQuery.data) {
      return;
    }
    if (manifestQuery.data.replayExpired) {
      return;
    }

    let cancelled = false;

    void loadReplayEvents(manifestQuery.data.manifest.batches)
      .then((events) => {
        if (cancelled || !containerRef.current || events.length === 0) {
          return;
        }
        containerRef.current.innerHTML = "";
        playerRef.current = new rrwebPlayer({
          props: {
            events,
            showController: true,
          },
          target: containerRef.current,
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      playerRef.current = null;
    };
  }, [manifestQuery.data, reportId]);


  if (manifestQuery.isLoading) {
    return <Loader aria-label="Loading replay" />;
  }

  if (manifestQuery.isError) {
    return (
      <Alert color="red" title="Unable to load replay">
        Replay manifest could not be loaded.
      </Alert>
    );
  }

  if (manifestQuery.data?.replayExpired) {
    const tier = manifestQuery.data.billingTier;
    const days = manifestQuery.data.retentionDaysReplay;
    return (
      <Alert color="yellow" title="Replay unavailable">
        Replay expired — {tier} retention is {days} days.
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      <Text c="dimmed" size="sm">
        Focus the player and use Space to play/pause, ←/→ to scrub ±5s.
      </Text>
      <Box
        ref={containerRef}
        tabIndex={0}
        style={{ minHeight: 360, outline: "none" }}
      />
    </Stack>
  );
}
