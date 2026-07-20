import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import { fetchWorkspaces } from "@/lib/api-server";
import { LinearSettings } from "./linear-settings";

export default async function WorkspaceLinearIntegrationSettingsPage({
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

  return (
    <Container py="xl">
      <LinearSettings workspaceSlug={slug} />
    </Container>
  );
}
