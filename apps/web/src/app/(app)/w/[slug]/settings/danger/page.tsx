import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import { ensureActiveOrganization, fetchDeletionStatus, fetchWorkspaces } from "@/lib/api-server";
import { DangerSettings } from "./danger-settings";

export default async function WorkspaceDangerSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: workspaces } = await fetchWorkspaces();
  const workspace = workspaces.find((row) => row.slug === slug);

  if (!workspace) {
    redirect("/settings/workspaces");
  }

  if (workspace.role !== "owner") {
    redirect(`/w/${slug}/projects`);
  }

  await ensureActiveOrganization(workspace.id);
  const { data: deletionStatus } = await fetchDeletionStatus(workspace.id);

  return (
    <Container py="xl">
      <DangerSettings
        initialStatus={deletionStatus}
        organizationId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={slug}
      />
    </Container>
  );
}
