"use client";

import {
  Alert,
  Button,
  Code,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProjectClient } from "@/app/(app)/settings/workspaces/actions";
import { CopyKeyButton } from "@/components/copy-key-button";

interface ProjectRow {
  createdAt: string;
  id: string;
  name: string;
  slug: string;
}

interface ProjectsListProps {
  organizationId: string;
  projects: ProjectRow[];
  workspaceSlug: string;
}

export function ProjectsList({
  organizationId,
  projects,
  workspaceSlug,
}: ProjectsListProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createProjectClient(organizationId, name);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.ingestKeyPlaintext) {
        setIngestKey(result.ingestKeyPlaintext);
      }
      setOpened(false);
      setName("");
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Projects</Title>
        <Button data-testid="create-project-btn" onClick={() => setOpened(true)}>
          Create project
        </Button>
      </Group>

      {error ? (
        <Alert color="red" data-testid="project-error" title="Error">
          {error}
        </Alert>
      ) : null}

      {ingestKey ? (
        <Alert
          color="blue"
          data-testid="ingest-key-once"
          title="Ingest key (shown once)"
        >
          <Group align="flex-end" gap="sm">
            <Code block>{ingestKey}</Code>
            <CopyKeyButton value={ingestKey} />
          </Group>
          <Text c="dimmed" mt="xs" size="sm">
            Store this key securely — it will not be shown again.
          </Text>
        </Alert>
      ) : null}

      <Table data-testid="projects-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Slug</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {projects.map((project) => (
            <Table.Tr data-testid={`project-row-${project.slug}`} key={project.id}>
              <Table.Td>{project.name}</Table.Td>
              <Table.Td>{project.slug}</Table.Td>
              <Table.Td>
                <Button
                  component={Link}
                  href={`/w/${workspaceSlug}/projects/${project.id}`}
                  size="xs"
                  variant="light"
                >
                  View
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal onClose={() => setOpened(false)} opened={opened} title="Create project">
        <Stack gap="md">
          <TextInput
            data-testid="project-name-input"
            label="Project name"
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <Button
            data-testid="submit-create-project"
            loading={isPending}
            onClick={handleCreate}
          >
            Create
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
