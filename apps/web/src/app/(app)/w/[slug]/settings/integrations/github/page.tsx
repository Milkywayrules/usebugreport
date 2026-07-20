import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { fetchWorkspaces } from "@/lib/api-server";

import { GitHubSettings } from "./github-settings";

export default async function WorkspaceGitHubIntegrationSettingsPage({
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
      <Suspense fallback={null}>
        <GitHubSettings workspaceSlug={slug} />
      </Suspense>
    </Container>
  );
}
