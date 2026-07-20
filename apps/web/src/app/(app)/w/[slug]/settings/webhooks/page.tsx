import { Container } from "@mantine/core";
import { redirect } from "next/navigation";
import { ensureActiveOrganization, fetchWorkspaces } from "@/lib/api-server";
import { WebhooksSettings } from "./webhooks-settings";

export default async function WorkspaceWebhooksPage({
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

  return (
    <Container py="xl">
      <WebhooksSettings billingTier={workspace.billingTier} workspaceSlug={slug} />
    </Container>
  );
}
