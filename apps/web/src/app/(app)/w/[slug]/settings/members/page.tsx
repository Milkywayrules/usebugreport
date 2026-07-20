import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import {
  ensureActiveOrganization,
  fetchWorkspaceMembers,
  fetchWorkspaces,
} from "@/lib/api-server";
import { MembersSettings } from "./members-settings";

export default async function WorkspaceMembersPage({
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

  if (workspace.role !== "owner" && workspace.role !== "admin") {
    redirect(`/w/${slug}/projects`);
  }

  await ensureActiveOrganization(workspace.id);
  const { data: members } = await fetchWorkspaceMembers(workspace.id);

  return (
    <Container py="xl">
      <MembersSettings
        members={members}
        organizationId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={slug}
      />
    </Container>
  );
}
