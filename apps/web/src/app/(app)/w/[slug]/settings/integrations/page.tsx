import { Anchor, Container, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { redirect } from "next/navigation";

import { fetchWorkspaces } from "@/lib/api-server";

export default async function WorkspaceIntegrationsSettingsPage({
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

  return (
    <Container py="xl">
      <Stack gap="md">
        <Title order={2}>Integrations</Title>
        <Text c="dimmed" size="sm">
          Connect external tools for workspace /w/{slug}.
        </Text>
        <Stack gap="xs">
          <Anchor component={Link} href={`/w/${slug}/settings/integrations/linear`}>
            Linear — push reports to Linear issues
          </Anchor>
          <Anchor component={Link} href={`/w/${slug}/settings/integrations/github`}>
            GitHub — push reports to GitHub Issues
          </Anchor>
        </Stack>
      </Stack>
    </Container>
  );
}
