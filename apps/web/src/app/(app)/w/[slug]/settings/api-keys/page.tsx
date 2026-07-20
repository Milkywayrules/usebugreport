import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import {
  ensureActiveOrganization,
  fetchApiKeys,
  fetchWorkspaces,
} from "@/lib/api-server";
import { ApiKeysSettings } from "./api-keys-settings";

export default async function WorkspaceApiKeysPage({
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
  const { data: apiKeys } = await fetchApiKeys(workspace.id);

  return (
    <Container py="xl">
      <ApiKeysSettings
        apiKeys={apiKeys}
        billingTier={workspace.billingTier}
        organizationId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={slug}
      />
    </Container>
  );
}
