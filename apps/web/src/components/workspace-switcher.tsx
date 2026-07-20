"use client";

import { Button, Group, Menu, Text } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useWorkspaceSwitch } from "@/components/workspace-switch-context";
import {
  formatPinSlotHint,
  type WorkspacePinSlot,
} from "@/keyboard/shortcuts";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceSwitcherProps {
  activeSlug?: string;
  pinnedWorkspaceIds: string[];
  workspaces: WorkspaceRow[];
}

export function WorkspaceSwitcher({
  activeSlug,
  pinnedWorkspaceIds,
  workspaces,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { switchWorkspace } = useWorkspaceSwitch();
  const os = useOs();
  const isMac = os === "macos";

  const pinSlotById = useMemo(() => {
    const map = new Map<string, WorkspacePinSlot>();
    pinnedWorkspaceIds.forEach((id, index) => {
      if (index < 9) {
        map.set(id, (index + 1) as WorkspacePinSlot);
      }
    });
    return map;
  }, [pinnedWorkspaceIds]);

  const ordered = useMemo(() => {
    const pinned = new Set(pinnedWorkspaceIds);
    const pinnedRows = pinnedWorkspaceIds
      .map((id) => workspaces.find((row) => row.id === id))
      .filter((row): row is WorkspaceRow => Boolean(row));
    const rest = workspaces.filter((row) => !pinned.has(row.id));
    return [...pinnedRows, ...rest];
  }, [pinnedWorkspaceIds, workspaces]);

  const active = workspaces.find((row) => row.slug === activeSlug);

  const handleSwitch = useCallback(
    (workspace: WorkspaceRow) => {
      switchWorkspace(workspace).catch(() => undefined);
    },
    [switchWorkspace]
  );

  const openSettings = useCallback(() => {
    router.push("/settings/workspaces");
  }, [router]);

  const switchHandlers = useMemo(
    () =>
      Object.fromEntries(
        ordered.map((workspace) => [
          workspace.id,
          () => {
            handleSwitch(workspace);
          },
        ])
      ) as Record<string, () => void>,
    [handleSwitch, ordered]
  );

  if (workspaces.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No workspaces
      </Text>
    );
  }

  return (
    <Menu position="bottom-start" shadow="md" width={260}>
      <Menu.Target>
        <Button data-testid="workspace-switcher" variant="subtle">
          {active?.name ?? "Select workspace"}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Workspaces</Menu.Label>
        {ordered.map((workspace) => {
          const slot = pinSlotById.get(workspace.id);
          return (
            <Menu.Item key={workspace.id} onClick={switchHandlers[workspace.id]}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Text size="sm">{workspace.name}</Text>
                <Group gap={6} wrap="nowrap">
                  {slot ? (
                    <Text c="dimmed" size="xs">
                      {formatPinSlotHint(slot, isMac)}
                    </Text>
                  ) : null}
                  {workspace.slug === activeSlug ? (
                    <Text c="dimmed" size="xs">
                      active
                    </Text>
                  ) : null}
                </Group>
              </Group>
            </Menu.Item>
          );
        })}
        <Menu.Divider />
        <Menu.Item onClick={openSettings}>Manage workspaces</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
