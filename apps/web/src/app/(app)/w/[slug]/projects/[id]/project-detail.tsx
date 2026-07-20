"use client";

import {
  Alert,
  Button,
  Code,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteProjectClient,
  rotateIngestKeyClient,
} from "@/app/(app)/settings/workspaces/actions";
import { CopyKeyButton } from "@/components/copy-key-button";

interface ProjectDetailProps {
  project: {
    id: string;
    name: string;
    slug: string;
  };
  workspaceSlug: string;
}

export function ProjectDetail({ project, workspaceSlug }: ProjectDetailProps) {
  const router = useRouter();
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRotate = () => {
    setError(null);
    startTransition(async () => {
      const result = await rotateIngestKeyClient(project.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setIngestKey(result.ingestKeyPlaintext ?? null);
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectClient(project.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/w/${workspaceSlug}/projects`);
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>{project.name}</Title>
        <Button component={Link} href={`/w/${workspaceSlug}/projects`} variant="subtle">
          Back to projects
        </Button>
      </Group>

      <Text c="dimmed">Slug: {project.slug}</Text>
      <Text c="dimmed" size="sm">
        Members: RBAC in E4-S4
      </Text>

      {error ? (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      ) : null}

      {ingestKey ? (
        <Alert
          color="blue"
          data-testid="rotated-ingest-key"
          title="New ingest key (shown once)"
        >
          <Group align="flex-end" gap="sm">
            <Code block data-testid="ingest-key-value">
              {ingestKey}
            </Code>
            <CopyKeyButton testId="copy-ingest-key" value={ingestKey} />
          </Group>
        </Alert>
      ) : null}

      <Group>
        <Button
          data-testid="rotate-ingest-key"
          loading={isPending}
          onClick={handleRotate}
        >
          Rotate ingest key
        </Button>
        <Button
          color="red"
          data-testid="delete-project"
          onClick={() => setDeleteOpened(true)}
          variant="light"
        >
          Delete project
        </Button>
      </Group>

      <Modal
        onClose={() => setDeleteOpened(false)}
        opened={deleteOpened}
        title="Delete project?"
      >
        <Stack gap="md">
          <Text size="sm">
            This permanently deletes the project and its ingest keys.
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setDeleteOpened(false)} variant="subtle">
              Cancel
            </Button>
            <Button
              color="red"
              data-testid="confirm-delete-project"
              loading={isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
