"use client";

import { AppShell, LoadingOverlay } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useParams } from "next/navigation";
import { useWorkspaceSwitch } from "@/components/workspace-switch-context";
import { AppHeader } from "./app-header";
import { AppNavbar } from "./app-navbar";

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

interface AppShellLayoutProps {
  activeSlug?: string;
  children: React.ReactNode;
  pinnedWorkspaceIds: string[];
  user?: {
    email?: string | null;
    image?: string | null;
    name?: string | null;
  } | null;
  workspaces: WorkspaceRow[];
}

export function AppShellLayout({
  activeSlug,
  children,
  pinnedWorkspaceIds,
  user,
  workspaces,
}: AppShellLayoutProps) {
  const [opened, { toggle }] = useDisclosure(true);
  const params = useParams();
  const routeSlug = params?.slug as string | undefined;
  const slug = routeSlug ?? activeSlug ?? "";
  const { isSwitching } = useWorkspaceSwitch();

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{
        breakpoint: "sm",
        collapsed: { desktop: !opened, mobile: !opened },
        width: 240,
      }}
      padding="md"
    >
      <AppShell.Header>
        <AppHeader
          activeSlug={activeSlug}
          onToggle={toggle}
          opened={opened}
          pinnedWorkspaceIds={pinnedWorkspaceIds}
          user={user}
          workspaces={workspaces}
        />
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <AppNavbar slug={slug} />
      </AppShell.Navbar>
      <AppShell.Main pos="relative">
        <LoadingOverlay
          data-testid="workspace-switch-loading"
          overlayProps={{ radius: "sm", blur: 2 }}
          visible={isSwitching}
          zIndex={200}
        />
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
