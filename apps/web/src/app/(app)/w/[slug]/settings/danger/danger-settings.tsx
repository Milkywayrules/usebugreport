"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { DeletionStatusRow } from "@/lib/api-server";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface DangerSettingsProps {
  initialStatus: DeletionStatusRow;
  organizationId: string;
  workspaceName: string;
  workspaceSlug: string;
}

async function readDeletionStatus(organizationId: string): Promise<DeletionStatusRow> {
  const response = await fetch(
    `${apiBase}/api/v1/workspaces/${organizationId}/deletion-status`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error("Failed to load deletion status");
  }
  const body = (await response.json()) as { data: DeletionStatusRow };
  return body.data;
}

export function DangerSettings({
  initialStatus,
  organizationId,
  workspaceName,
  workspaceSlug,
}: DangerSettingsProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status.status === "none" || status.status === "complete") {
      return;
    }
    const timer = setInterval(() => {
      void readDeletionStatus(organizationId)
        .then(setStatus)
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [organizationId, status.status]);

  const inProgress = status.status !== "none" && status.status !== "complete";

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `${apiBase}/api/v1/workspaces/${organizationId}/deletion`,
        { credentials: "include", method: "POST" }
      );
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(body.error?.message ?? "Deletion request failed");
        return;
      }
      setOpened(false);
      setConfirmSlug("");
      const next = await readDeletionStatus(organizationId);
      setStatus(next);
      router.push("/settings/workspaces");
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Title order={2}>Danger zone</Title>
      <Text c="dimmed">
        Permanently delete {workspaceName} and all associated reports, keys, and integrations.
      </Text>

      {inProgress ? (
        <Alert
          color="orange"
          data-testid="deletion-status-panel"
          title="Deletion in progress"
        >
          Current step: {status.lastCompletedStep ?? status.status}
        </Alert>
      ) : null}

      {error ? (
        <Alert color="red" data-testid="deletion-error" title="Error">
          {error}
        </Alert>
      ) : null}

      <Group>
        <Button
          color="red"
          data-testid="open-delete-workspace"
          disabled={inProgress}
          onClick={() => setOpened(true)}
        >
          Delete workspace
        </Button>
      </Group>

      <Modal
        data-testid="delete-workspace-modal"
        onClose={() => setOpened(false)}
        opened={opened}
        title="Delete workspace"
      >
        <Stack gap="sm">
          <Text size="sm">
            Type <strong>{workspaceSlug}</strong> to confirm. This schedules irreversible GDPR
            deletion.
          </Text>
          <TextInput
            data-testid="confirm-slug-input"
            label="Workspace slug"
            onChange={(event) => setConfirmSlug(event.currentTarget.value)}
            value={confirmSlug}
          />
          <Button
            color="red"
            data-testid="confirm-delete-workspace"
            disabled={confirmSlug !== workspaceSlug || isPending}
            loading={isPending}
            onClick={handleDelete}
          >
            Confirm deletion
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
