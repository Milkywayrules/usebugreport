import { Container } from "@mantine/core";
import { notFound } from "next/navigation";
import {
  ensureActiveOrganization,
  fetchProject,
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

  const project = await fetchProject(id);
  if (!project) {
    notFound();
  }

  return (
    <Container py="xl">
      <ProjectDetail project={project} workspaceSlug={slug} />
    </Container>
  );
}
