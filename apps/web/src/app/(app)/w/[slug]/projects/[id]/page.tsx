import { Container } from "@mantine/core";
import { notFound } from "next/navigation";
import {
  ensureActiveOrganization,
  fetchProject,
  fetchProjectMembers,
  fetchWorkspaceMembers,
  fetchWorkspaces,
} from "@/lib/api-server";
import { ProjectDetail } from "./project-detail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const { data: workspaces } = await fetchWorkspaces();
  const workspace = workspaces.find((row) => row.slug === slug);

  if (!workspace) {
    notFound();
  }

  await ensureActiveOrganization(workspace.id);

  const projectResult = await fetchProject(id);
  if (!projectResult) {
    notFound();
  }

  const membersResult = projectResult.capabilities.canManageMembers
    ? await fetchProjectMembers(id)
    : { data: [] };
  const orgMembersResult = projectResult.capabilities.canManageMembers
    ? await fetchWorkspaceMembers(workspace.id)
    : { data: [] };

  return (
    <Container py="xl">
      <ProjectDetail
        capabilities={projectResult.capabilities}
        members={membersResult.data}
        orgMembers={orgMembersResult.data}
        project={projectResult.project}
        workspaceSlug={slug}
      />
    </Container>
  );
}
