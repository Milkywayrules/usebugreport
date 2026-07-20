"use client";

import { Button, Group, Menu, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { authClient } from "@/lib/auth-client";

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
    async (workspace: WorkspaceRow) => {
      await (
        authClient as unknown as {
          organization: {
            setActive: (input: { organizationId: string }) => Promise<unknown>;
          };
        }
      ).organization.setActive({
        organizationId: workspace.id,
      });
      router.push(`/w/${workspace.slug}/reports`);
      router.refresh();
    },
    [router]
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
            handleSwitch(workspace).catch(() => undefined);
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
        {ordered.map((workspace) => (
          <Menu.Item key={workspace.id} onClick={switchHandlers[workspace.id]}>
            <Group gap="xs" justify="space-between">
              <Text size="sm">{workspace.name}</Text>
              {workspace.slug === activeSlug ? (
                <Text c="dimmed" size="xs">
                  active
                </Text>
              ) : null}
            </Group>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item onClick={openSettings}>Manage workspaces</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
