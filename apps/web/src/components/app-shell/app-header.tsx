"use client";

import { Burger, Group, Text } from "@mantine/core";
import Link from "next/link";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { UserMenu } from "./user-menu";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface AppHeaderProps {
  activeSlug?: string;
  onToggle: () => void;
  opened: boolean;
  pinnedWorkspaceIds: string[];
  user?: {
    email?: string | null;
    image?: string | null;
    name?: string | null;
  } | null;
  workspaces: WorkspaceRow[];
}

export function AppHeader({
  activeSlug,
  onToggle,
  opened,
  pinnedWorkspaceIds,
  user,
  workspaces,
}: AppHeaderProps) {
  return (
    <Group h="100%" justify="space-between" px="md" wrap="nowrap">
      <Group gap="md" wrap="nowrap">
        <Burger onClick={onToggle} opened={opened} size="sm" />
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <Text fw={600} size="sm">
            usebugreport
          </Text>
        </Link>
        <WorkspaceSwitcher
          activeSlug={activeSlug}
          pinnedWorkspaceIds={pinnedWorkspaceIds}
          workspaces={workspaces}
        />
      </Group>
      <Group gap="md" wrap="nowrap">
        <Text c="dimmed" size="xs">
          ⌘K
        </Text>
        <UserMenu user={user} />
      </Group>
    </Group>
  );
}
