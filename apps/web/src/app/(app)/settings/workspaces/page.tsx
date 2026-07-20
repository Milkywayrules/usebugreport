import { Container } from "@mantine/core";
import { fetchUserPreferences, fetchWorkspaces } from "@/lib/api-server";
import { WorkspacesSettings } from "./workspaces-settings";

export default async function WorkspacesSettingsPage() {
  const { data: workspaces } = await fetchWorkspaces();
  const preferences = await fetchUserPreferences();

  return (
    <Container py="xl">
      <WorkspacesSettings
        initialPinnedIds={preferences.pinnedWorkspaceIds}
        workspaces={workspaces}
      />
    </Container>
  );
}
