"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createWorkspaceClient,
  togglePinClient,
  updatePinOrderClient,
} from "./actions";

interface WorkspaceRow {
  billingTier: string;
  id: string;
  name: string;
  role: string;
  slug: string;
}

interface WorkspacesSettingsProps {
  initialPinnedIds: string[];
  workspaces: WorkspaceRow[];
}

export function WorkspacesSettings({
  initialPinnedIds,
  workspaces,
}: WorkspacesSettingsProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState(initialPinnedIds);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createWorkspaceClient(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpened(false);
      setName("");
      router.refresh();
    });
  };

  const handleTogglePin = (organizationId: string) => {
    startTransition(async () => {
      const next = pinnedIds.includes(organizationId)
        ? pinnedIds.filter((id) => id !== organizationId)
        : [...pinnedIds, organizationId];
      const result = await togglePinClient(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPinnedIds(next);
      router.refresh();
    });
  };

  const movePin = (organizationId: string, direction: -1 | 1) => {
    const index = pinnedIds.indexOf(organizationId);
    if (index < 0) {
      return;
    }
    const target = index + direction;
    if (target < 0 || target >= pinnedIds.length) {
      return;
    }
    const next = [...pinnedIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    startTransition(async () => {
      const result = await updatePinOrderClient(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPinnedIds(next);
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Workspaces</Title>
        <Button
          data-testid="create-workspace-btn"
          onClick={() => {
            setError(null);
            setOpened(true);
          }}
        >
          Create workspace
        </Button>
      </Group>

      {error ? (
        <Alert color="red" data-testid="workspace-error" title="Error">
          {error}
        </Alert>
      ) : null}

      <Table data-testid="workspaces-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Slug</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Pin</Table.Th>
            <Table.Th>Order</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {workspaces.map((workspace) => {
            const pinned = pinnedIds.includes(workspace.id);
            return (
              <Table.Tr data-testid={`workspace-row-${workspace.slug}`} key={workspace.id}>
                <Table.Td>{workspace.name}</Table.Td>
                <Table.Td>{workspace.slug}</Table.Td>
                <Table.Td>{workspace.role}</Table.Td>
                <Table.Td>
                  <ActionIcon
                    aria-label={pinned ? "Unpin workspace" : "Pin workspace"}
                    data-testid={`pin-${workspace.slug}`}
                    onClick={() => handleTogglePin(workspace.id)}
                    variant={pinned ? "filled" : "light"}
                  >
                    ★
                  </ActionIcon>
                </Table.Td>
                <Table.Td>
                  {pinned ? (
                    <Group gap={4}>
                      <ActionIcon
                        aria-label="Move pin up"
                        onClick={() => movePin(workspace.id, -1)}
                        size="sm"
                        variant="subtle"
                      >
                        ↑
                      </ActionIcon>
                      <ActionIcon
                        aria-label="Move pin down"
                        onClick={() => movePin(workspace.id, 1)}
                        size="sm"
                        variant="subtle"
                      >
                        ↓
                      </ActionIcon>
                    </Group>
                  ) : (
                    <Text c="dimmed" size="xs">
                      —
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      <Modal
        onClose={() => setOpened(false)}
        opened={opened}
        title="Create workspace"
      >
        <Stack gap="md">
          <TextInput
            data-testid="workspace-name-input"
            label="Workspace name"
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          {error ? (
            <Alert color="red" data-testid="create-workspace-error">
              {error}
            </Alert>
          ) : null}
          <Button
            data-testid="submit-create-workspace"
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
