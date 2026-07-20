import { Group } from "@mantine/core";
import Link from "next/link";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { fetchUserPreferences, fetchWorkspaces } from "@/lib/api-server";
import { getServerSession } from "@/lib/auth-server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { organizations, session } = await getServerSession();
  const { data: workspaces } = await fetchWorkspaces();
  const preferences = await fetchUserPreferences();

  const activeOrgId =
    (session as { activeOrganizationId?: string | null } | null)
      ?.activeOrganizationId ?? undefined;
  const activeSlug =
    workspaces.find((row) => row.id === activeOrgId)?.slug ??
    (organizations[0] as { slug?: string } | undefined)?.slug;

  return (
    <div>
      <header
        style={{
          alignItems: "center",
          borderBottom: "1px solid var(--mantine-color-gray-3)",
          display: "flex",
          justifyContent: "space-between",
          padding: "0.75rem 1.5rem",
        }}
      >
        <Group gap="md">
          <Link href="/">usebugreport</Link>
          <WorkspaceSwitcher
            activeSlug={activeSlug}
            pinnedWorkspaceIds={preferences.pinnedWorkspaceIds}
            workspaces={workspaces}
          />
        </Group>
        <Group gap="sm">
          <Link href="/settings/workspaces">Workspaces</Link>
          {workspaces.some(
            (row) => row.role === "owner" || row.role === "admin"
          ) && activeSlug ? (
            <Link href={`/w/${activeSlug}/settings/members`}>Members</Link>
          ) : null}
          <Link href="/settings/account">Account</Link>
        </Group>
      </header>
      {children}
    </div>
  );
}
