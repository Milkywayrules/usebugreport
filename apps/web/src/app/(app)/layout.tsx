import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { Providers } from "@/components/providers";
import { fetchUserPreferences, fetchWorkspaces } from "@/lib/api-server";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { organizations, session, user } = await getServerSession();
  const { data: workspaces } = await fetchWorkspaces();
  const preferences = await fetchUserPreferences();

  const activeOrgId =
    (session as { activeOrganizationId?: string | null } | null)
      ?.activeOrganizationId ?? undefined;
  const activeSlug =
    workspaces.find((row) => row.id === activeOrgId)?.slug ??
    (organizations[0] as { slug?: string } | undefined)?.slug;

  return (
    <Providers>
      <AppShellLayout
        activeSlug={activeSlug}
        pinnedWorkspaceIds={preferences.pinnedWorkspaceIds}
        user={user}
        workspaces={workspaces}
      >
        {children}
      </AppShellLayout>
    </Providers>
  );
}
