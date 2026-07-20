"use client";

import type { SpotlightActionData } from "@mantine/spotlight";
import { useMantineColorScheme } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useWorkspaceSwitch } from "@/components/workspace-switch-context";
import { GLOBAL_SHORTCUTS, WORKSPACE_SPOTLIGHT_ACTIONS } from "@/keyboard/shortcuts";
import { useSpotlightCommandBridge } from "@/keyboard/spotlight-command-context";
import { recordSpotlightRecent } from "@/keyboard/spotlight-recent";
import type { ReportStatusValue } from "@/lib/reports/status";
import { pushReportToLinear } from "@/lib/reports/bulk-linear-push-api";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface UseRegisterSpotlightActionsInput {
  activeSlug?: string;
  mode: "root" | "switch";
  onEnterSwitchMode: () => void;
  onOpenShortcuts?: () => void;
  query: string;
  searchHits: Array<{ id: string; title: string }>;
  workspaces: WorkspaceRow[];
}

function withRecent(
  action: SpotlightActionData,
  run: () => void
): SpotlightActionData {
  return {
    ...action,
    onClick: () => {
      recordSpotlightRecent(action.id);
      run();
    },
  };
}

const STATUS_ACTIONS: Array<{
  id: string;
  label: string;
  status: ReportStatusValue;
}> = [
  { id: "report.status.open", label: "Mark open", status: "open" },
  { id: "report.status.in_progress", label: "Mark in progress", status: "in_progress" },
  { id: "report.status.resolved", label: "Mark resolved", status: "resolved" },
  { id: "report.status.closed", label: "Mark closed", status: "closed" },
  { id: "report.status.duplicate", label: "Mark duplicate", status: "duplicate" },
];

export function useRegisterSpotlightActions({
  activeSlug,
  mode,
  onEnterSwitchMode,
  onOpenShortcuts,
  query,
  searchHits,
  workspaces,
}: UseRegisterSpotlightActionsInput): SpotlightActionData[] {
  const router = useRouter();
  const { switchWorkspace } = useWorkspaceSwitch();
  const { bridge } = useSpotlightCommandBridge();
  const { toggleColorScheme } = useMantineColorScheme();
  const slug = bridge.workspaceSlug ?? activeSlug ?? workspaces[0]?.slug ?? "";

  return useMemo(() => {
    if (mode === "switch") {
      return workspaces.map((workspace) =>
        withRecent(
          {
            description: workspace.slug,
            id: `ws.switch.${workspace.id}`,
            keywords: [workspace.name, workspace.slug],
            label: workspace.name,
          },
          () => {
            if (workspace.slug !== activeSlug) {
              switchWorkspace(workspace).catch(() => undefined);
            }
          }
        )
      );
    }

    const actions: SpotlightActionData[] = [];
    const trimmed = query.trim();
    const selectionCount = bridge.selectedReportIds.length;
    const reportId = bridge.reportId;

    const nav = (id: string, label: string, path: string, keywords: string[] = []) =>
      withRecent({ id, label, keywords, description: path }, () => router.push(path));

    if (!trimmed && selectionCount > 0 && bridge.canEdit) {
      actions.push(
        withRecent(
          {
            id: "bulk.status",
            label: `Change status for ${selectionCount} reports…`,
            keywords: ["bulk", "status"],
          },
          () => notifications.show({ message: "Use bulk bar status menu for now." })
        ),
        withRecent(
          {
            id: "bulk.push-linear",
            label: `Push ${selectionCount} reports to Linear`,
            keywords: ["bulk", "linear"],
          },
          () => {
            if (bridge.bulkPushLinear) {
              bridge.bulkPushLinear();
              return;
            }
            notifications.show({ message: "Select reports on the list first." });
          }
        )
      );
    }

    actions.push(
      nav("nav.reports", "Go to Reports", `/w/${slug}/reports`, ["reports", "triage"]),
      nav("nav.projects", "Go to Projects", `/w/${slug}/projects`, ["projects"]),
      nav("nav.settings", "Go to Settings", `/w/${slug}/settings`, ["settings"]),
      nav(
        "nav.integrations.linear",
        "Linear integration",
        `/w/${slug}/settings/integrations/linear`,
        ["linear"]
      ),
      nav("nav.api-keys", "API keys", `/w/${slug}/settings/api-keys`, ["api", "mcp"]),
      nav("nav.webhooks", "Webhooks", `/w/${slug}/settings/webhooks`, ["webhook"]),
      nav("nav.usage", "Usage & billing", `/w/${slug}/settings/usage`, ["usage"]),
      nav("nav.onboarding", "SDK setup", "/onboarding", ["sdk"]),
      withRecent(
        {
          closeSpotlightOnTrigger: false,
          description: "Fuzzy search memberships",
          id: WORKSPACE_SPOTLIGHT_ACTIONS.switch.id,
          label: WORKSPACE_SPOTLIGHT_ACTIONS.switch.label,
        },
        onEnterSwitchMode
      ),
      withRecent(
        { id: WORKSPACE_SPOTLIGHT_ACTIONS.pinManage.id, label: WORKSPACE_SPOTLIGHT_ACTIONS.pinManage.label },
        () => router.push("/settings/workspaces")
      ),
      withRecent(
        { id: WORKSPACE_SPOTLIGHT_ACTIONS.create.id, label: WORKSPACE_SPOTLIGHT_ACTIONS.create.label },
        () => router.push("/settings/workspaces?create=1")
      ),
      withRecent(
        {
          id: "settings.theme",
          label: "Toggle dark/light theme",
          keywords: ["theme", "dark", "light"],
        },
        () => toggleColorScheme()
      ),
      withRecent(
        {
          id: "settings.shortcuts",
          label: "Keyboard shortcuts",
          description: GLOBAL_SHORTCUTS.help.keys,
          keywords: ["help", "shortcuts"],
        },
        () => onOpenShortcuts?.()
      )
    );

    if (reportId && bridge.canEdit && bridge.patchStatus) {
      for (const row of STATUS_ACTIONS) {
        actions.push(
          withRecent(
            { id: row.id, label: row.label, keywords: ["status", row.status] },
            () => {
              bridge.patchStatus?.(reportId, row.status).catch(() =>
                notifications.show({ color: "red", message: "Status update failed." })
              );
            }
          )
        );
      }

      actions.push(
        withRecent(
          {
            id: "report.push-linear",
            label: "Push to Linear",
            keywords: ["linear", "push"],
          },
          () =>
            bridge.pushLinear?.() ??
            (bridge.reportId
              ? pushReportToLinear(bridge.reportId)
                  .then(() =>
                    notifications.show({ color: "green", message: "Pushed to Linear." })
                  )
                  .catch((error) =>
                    notifications.show({
                      color: "red",
                      message: error instanceof Error ? error.message : "Linear push failed.",
                    })
                  )
              : notifications.show({ message: "Open a report to push to Linear." }))
        ),
        withRecent(
          {
            id: "report.copy-url",
            label: "Copy report URL",
            keywords: ["copy", "url"],
          },
          () => {
            const url = `${window.location.origin}/w/${slug}/reports/${reportId}`;
            navigator.clipboard.writeText(url).catch(() => undefined);
            notifications.show({ message: "Report URL copied." });
          }
        ),
        withRecent(
          {
            id: "report.copy-id",
            label: "Copy report ID",
            keywords: ["copy", "id"],
          },
          () => {
            navigator.clipboard.writeText(reportId).catch(() => undefined);
            notifications.show({ message: "Report ID copied." });
          }
        )
      );
    }

    if (trimmed.length >= 2) {
      for (const hit of searchHits) {
        actions.unshift({
          description: hit.id,
          id: `report.open.${hit.id}`,
          label: hit.title,
          onClick: () => {
            recordSpotlightRecent(`report.open.${hit.id}`);
            router.push(`/w/${slug}/reports/${hit.id}`);
          },
        });
      }

      for (const project of bridge.projects.filter((row) =>
        row.name.toLowerCase().includes(trimmed.toLowerCase())
      )) {
        actions.unshift({
          description: project.id,
          id: `project.open.${project.id}`,
          label: project.name,
          onClick: () => {
            recordSpotlightRecent(`project.open.${project.id}`);
            router.push(`/w/${slug}/reports?project=${project.id}`);
          },
        });
      }
    }

    return actions;
  }, [
    activeSlug,
    bridge,
    mode,
    onEnterSwitchMode,
    onOpenShortcuts,
    query,
    router,
    searchHits,
    switchWorkspace,
    toggleColorScheme,
    workspaces,
    slug,
  ]);
}
