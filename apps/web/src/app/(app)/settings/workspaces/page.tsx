import { Container } from "@mantine/core";
import { fetchDeletionStatus, fetchUserPreferences, fetchWorkspaces } from "@/lib/api-server";
import { WorkspacesSettings } from "./workspaces-settings";

export default async function WorkspacesSettingsPage() {
  const { data: workspaces } = await fetchWorkspaces();
  const preferences = await fetchUserPreferences();

  const deletionByOrgId: Record<
    string,
    { lastCompletedStep: string | null; status: string }
  > = {};

  await Promise.all(
    workspaces
      .filter((workspace) => workspace.role === "owner")
      .map(async (workspace) => {
        try {
          const { data } = await fetchDeletionStatus(workspace.id);
          if (data.status !== "none") {
            deletionByOrgId[workspace.id] = {
              lastCompletedStep: data.lastCompletedStep,
              status: data.status,
            };
          }
        } catch {
          // ignore per-workspace status failures
        }
      })
  );

  return (
    <Container py="xl">
      <WorkspacesSettings
        deletionByOrgId={deletionByOrgId}
        initialPinnedIds={preferences.pinnedWorkspaceIds}
        workspaces={workspaces}
      />
    </Container>
  );
}
