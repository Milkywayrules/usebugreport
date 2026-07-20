"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import type { WorkspaceMemberRow } from "@/lib/api-server";

const ORG_ROLES = [
  { label: "Member", value: "member" },
  { label: "Admin", value: "admin" },
];

interface MembersSettingsProps {
  members: WorkspaceMemberRow[];
  organizationId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export function MembersSettings({
  members,
  organizationId,
  workspaceName,
  workspaceSlug,
}: MembersSettingsProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleInvite = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const client = authClient as unknown as {
        organization: {
          inviteMember: (input: {
            email: string;
            organizationId: string;
            role: string;
          }) => Promise<{ error?: { message?: string } }>;
        };
      };

      const result = await client.organization.inviteMember({
        email: email.trim(),
        organizationId,
        role,
      });

      if (result.error) {
        setError(result.error.message ?? "Unable to send invite.");
        return;
      }

      setSuccess(`Invitation sent to ${email.trim()}.`);
      setOpened(false);
      setEmail("");
      setRole("member");
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>{workspaceName} members</Title>
        <Button
          data-testid="invite-org-member-btn"
          onClick={() => setOpened(true)}
        >
          Invite member
        </Button>
      </Group>

      <Text c="dimmed" size="sm">
        Workspace: /w/{workspaceSlug}/settings/members
      </Text>

      {error ? (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert color="green" title="Success">
          {success}
        </Alert>
      ) : null}

      <Table data-testid="org-members-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Org role</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {members.map((memberRow) => (
            <Table.Tr key={memberRow.userId}>
              <Table.Td>{memberRow.name}</Table.Td>
              <Table.Td>{memberRow.email}</Table.Td>
              <Table.Td>{memberRow.role}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        onClose={() => setOpened(false)}
        opened={opened}
        title="Invite workspace member"
      >
        <Stack gap="md">
          <TextInput
            data-testid="invite-email-input"
            label="Email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            type="email"
            value={email}
          />
          <Select
            data={ORG_ROLES}
            data-testid="invite-role-select"
            label="Org role"
            onChange={(value) => setRole(value ?? "member")}
            value={role}
          />
          <Group justify="flex-end">
            <Button onClick={() => setOpened(false)} variant="subtle">
              Cancel
            </Button>
            <Button
              data-testid="submit-invite-member"
              loading={isPending}
              onClick={handleInvite}
            >
              Send invite
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
