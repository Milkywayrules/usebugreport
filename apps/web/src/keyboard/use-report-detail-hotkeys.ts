"use client";

import { useHotkeys } from "@mantine/hooks";
import { REPORT_DETAIL_SHORTCUTS } from "@/keyboard/shortcuts";

export function useReportDetailHotkeys({
  enabled,
  onPushLinear,
  workspaceSlug,
}: {
  enabled: boolean;
  onPushLinear: () => void | Promise<void>;
  workspaceSlug: string;
}) {
  useHotkeys(
    [
      [REPORT_DETAIL_SHORTCUTS.pushLinear.keys, () => void onPushLinear()],
    ],
    [],
    enabled
  );
}
