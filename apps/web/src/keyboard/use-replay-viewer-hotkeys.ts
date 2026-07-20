"use client";

import { useHotkeys, type HotkeyItem } from "@mantine/hooks";
import { useMemo, type RefObject } from "react";
import { isEditableTarget } from "@/keyboard/is-editable-target";
import { REPLAY_SHORTCUTS } from "@/keyboard/shortcuts";

type RrwebReplayer = {
  getCurrentTime: () => number;
  pause: () => void;
  play: (time?: number) => void;
  service: { state: { value: string } };
};

type RrwebPlayer = {
  getReplayer: () => RrwebReplayer;
};

interface UseReplayViewerHotkeysOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  playerRef: RefObject<RrwebPlayer | null>;
}

export function useReplayViewerHotkeys({
  active,
  containerRef,
  playerRef,
}: UseReplayViewerHotkeysOptions): void {
  const hotkeys = useMemo(() => {
    if (!active) {
      return [] as HotkeyItem[];
    }

    const handle = (event: KeyboardEvent, action: () => void) => {
      const player = playerRef.current;
      if (!player || !containerRef.current?.contains(document.activeElement)) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      action();
    };

    return [
      [
        REPLAY_SHORTCUTS.playPause.keys,
        (event) => {
          handle(event, () => {
            const replayer = playerRef.current?.getReplayer();
            if (!replayer) return;
            if (replayer.service.state.value === "playing") {
              replayer.pause();
            } else {
              replayer.play();
            }
          });
        },
      ],
      [
        REPLAY_SHORTCUTS.scrubForward.keys,
        (event) => {
          handle(event, () => {
            const replayer = playerRef.current?.getReplayer();
            if (!replayer) return;
            replayer.play(replayer.getCurrentTime() + 5000);
          });
        },
      ],
      [
        REPLAY_SHORTCUTS.scrubBack.keys,
        (event) => {
          handle(event, () => {
            const replayer = playerRef.current?.getReplayer();
            if (!replayer) return;
            replayer.play(Math.max(0, replayer.getCurrentTime() - 5000));
          });
        },
      ],
    ] satisfies HotkeyItem[];
  }, [active, containerRef, playerRef]);

  useHotkeys(hotkeys);
}
