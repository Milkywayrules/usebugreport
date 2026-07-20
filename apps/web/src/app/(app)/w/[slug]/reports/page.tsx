import { Container } from "@mantine/core";
import { notFound } from "next/navigation";
import {
  ensureActiveOrganization,
  fetchProjects,
  fetchWorkspaces,
} from "@/lib/api-server";
import { ReportsList } from "./reports-list";

export default async function WorkspaceReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: workspaces } = await fetchWorkspaces();
  const workspace = workspaces.find((row) => row.slug === slug);

  if (!workspace) {
    notFound();
  }

  await ensureActiveOrganization(workspace.id);

  const { data: projects } = await fetchProjects(workspace.id);
  const canEdit = workspace.role !== "viewer";

  return (
    <Container py="xl">
      <ReportsList
        canEdit={canEdit}
        organizationId={workspace.id}
        projects={projects}
        workspaceSlug={slug}
      />
    </Container>
  );
}
