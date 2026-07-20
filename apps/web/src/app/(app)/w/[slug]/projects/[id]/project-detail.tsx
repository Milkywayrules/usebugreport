"use client";

import {
  Alert,
  Button,
  Code,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CopyKeyButton } from "@/components/copy-key-button";
import type {
  ProjectMemberRow,
  WorkspaceMemberRow,
} from "@/lib/api-server";
import {
  addProjectMemberClient,
  deleteProjectClient,
  removeProjectMemberClient,
  rotateIngestKeyClient,
  updateProjectMemberRoleClient,
} from "./actions";

const PROJECT_ROLES = [
  { label: "Viewer", value: "viewer" },
  { label: "Reporter", value: "reporter" },
  { label: "Developer", value: "developer" },
  { label: "Admin", value: "admin" },
];

interface ProjectCapabilities {
  canDelete: boolean;
  canManageMembers: boolean;
  canRotate: boolean;
  canUpdate: boolean;
  effectiveRole: string | null;
}

interface ProjectDetailProps {
  capabilities: ProjectCapabilities;
  members: ProjectMemberRow[];
  orgMembers: WorkspaceMemberRow[];
  project: {
    id: string;
    name: string;
    slug: string;
  };
  workspaceSlug: string;
}

export function ProjectDetail({
  capabilities,
  members: initialMembers,
  orgMembers,
  project,
  workspaceSlug,
}: ProjectDetailProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [addOpened, setAddOpened] = useState(false);
  const [addUserId, setAddUserId] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<string>("viewer");
  const [isPending, startTransition] = useTransition();

  const availableOrgMembers = useMemo(
    () =>
      orgMembers.filter(
        (orgMember) =>
          !members.some((memberRow) => memberRow.userId === orgMember.userId)
      ),
    [members, orgMembers]
  );

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

  const handleAddMember = () => {
    if (!addUserId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addProjectMemberClient(
        project.id,
        addUserId,
        addRole
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setAddOpened(false);
      setAddUserId(null);
      setAddRole("viewer");
      router.refresh();
    });
  };

  const handleRoleChange = (userId: string, role: string | null) => {
    if (!role) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateProjectMemberRoleClient(
        project.id,
        userId,
        role
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMembers((current) =>
        current.map((row) =>
          row.userId === userId ? { ...row, role } : row
        )
      );
      router.refresh();
    });
  };

  const handleRemoveMember = (userId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeProjectMemberClient(project.id, userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMembers((current) =>
        current.filter((row) => row.userId !== userId)
      );
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>{project.name}</Title>
        <Button
          component={Link}
          href={`/w/${workspaceSlug}/projects`}
          variant="subtle"
        >
          Back to projects
        </Button>
      </Group>

      <Text c="dimmed">Slug: {project.slug}</Text>
      {capabilities.effectiveRole ? (
        <Text c="dimmed" size="sm">
          Your role: {capabilities.effectiveRole}
        </Text>
      ) : null}

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

      {capabilities.canManageMembers ? (
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Members</Title>
            <Button
              data-testid="add-project-member-btn"
              onClick={() => setAddOpened(true)}
              size="xs"
            >
              Add member
            </Button>
          </Group>
          <Table data-testid="project-members-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {members.map((memberRow) => (
                <Table.Tr
                  data-testid={`project-member-${memberRow.userId}`}
                  key={memberRow.userId}
                >
                  <Table.Td>{memberRow.name}</Table.Td>
                  <Table.Td>{memberRow.email}</Table.Td>
                  <Table.Td>
                    <Select
                      data={PROJECT_ROLES}
                      data-testid={`member-role-${memberRow.userId}`}
                      disabled={isPending}
                      onChange={(value) =>
                        handleRoleChange(memberRow.userId, value)
                      }
                      size="xs"
                      value={memberRow.role}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Button
                      color="red"
                      data-testid={`remove-member-${memberRow.userId}`}
                      disabled={isPending}
                      onClick={() => handleRemoveMember(memberRow.userId)}
                      size="xs"
                      variant="subtle"
                    >
                      Remove
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : null}

      {capabilities.canRotate || capabilities.canDelete ? (
        <Group>
          {capabilities.canRotate ? (
            <Button
              data-testid="rotate-ingest-key"
              loading={isPending}
              onClick={handleRotate}
            >
              Rotate ingest key
            </Button>
          ) : null}
          {capabilities.canDelete ? (
            <Button
              color="red"
              data-testid="delete-project"
              onClick={() => setDeleteOpened(true)}
              variant="light"
            >
              Delete project
            </Button>
          ) : null}
        </Group>
      ) : null}

      <Modal
        onClose={() => setAddOpened(false)}
        opened={addOpened}
        title="Add project member"
      >
        <Stack gap="md">
          <Select
            data={availableOrgMembers.map((row) => ({
              label: `${row.name} (${row.email})`,
              value: row.userId,
            }))}
            data-testid="add-member-select"
            label="Workspace member"
            onChange={setAddUserId}
            searchable
            value={addUserId}
          />
          <Select
            data={PROJECT_ROLES}
            data-testid="add-member-role-select"
            label="Project role"
            onChange={(value) => setAddRole(value ?? "viewer")}
            value={addRole}
          />
          <Group justify="flex-end">
            <Button onClick={() => setAddOpened(false)} variant="subtle">
              Cancel
            </Button>
            <Button
              data-testid="submit-add-member"
              loading={isPending}
              onClick={handleAddMember}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>

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
