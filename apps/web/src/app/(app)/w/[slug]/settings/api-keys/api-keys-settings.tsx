"use client";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CopyKeyButton } from "@/components/copy-key-button";
import type { ApiKeyRow } from "@/lib/api-server";
import {
  createApiKeyClient,
  revokeApiKeyClient,
  rotateApiKeyClient,
} from "./actions";

const ALL_SCOPES = [
  { label: "Reports read", tier: "free", value: "reports:read" },
  { label: "Reports write", tier: "pro", value: "reports:write" },
  { label: "MCP tools", tier: "free", value: "mcp:tools" },
  { label: "Webhooks manage", tier: "pro", value: "webhooks:manage" },
] as const;

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  return date.toLocaleDateString();
}

interface ApiKeysSettingsProps {
  apiKeys: ApiKeyRow[];
  billingTier: string;
  organizationId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export function ApiKeysSettings({
  apiKeys: initialKeys,
  billingTier,
  organizationId,
  workspaceName,
  workspaceSlug,
}: ApiKeysSettingsProps) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [createOpened, setCreateOpened] = useState(false);
  const [showOnceOpened, setShowOnceOpened] = useState(false);
  const [showOnceKey, setShowOnceKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiKeyRow | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["reports:read", "mcp:tools"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isFreeTier = billingTier === "free";

  const scopeOptions = useMemo(
    () =>
      ALL_SCOPES.map((scope) => {
        const disabled = isFreeTier && scope.tier === "pro";
        const checkbox = (
          <Checkbox
            disabled={disabled}
            key={scope.value}
            label={scope.label}
            value={scope.value}
          />
        );
        if (disabled) {
          return (
            <Tooltip
              key={scope.value}
              label="Upgrade to Pro to enable write and webhook scopes"
            >
              <div>{checkbox}</div>
            </Tooltip>
          );
        }
        return checkbox;
      }),
    [isFreeTier]
  );

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createApiKeyClient(organizationId, {
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        name,
        scopes,
      });
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.apiKey) {
        setKeys((current) => [result.apiKey!, ...current]);
      }
      setCreateOpened(false);
      setName("");
      setScopes(["reports:read", "mcp:tools"]);
      setExpiresAt("");
      setShowOnceKey(result.keyPlaintext ?? null);
      setShowOnceOpened(true);
      router.refresh();
    });
  };

  const handleRotate = () => {
    if (!rotateTarget) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rotateApiKeyClient(organizationId, rotateTarget.id);
      if (result.error) {
        setError(result.error);
        return;
      }

      setKeys((current) =>
        current
          .filter((row) => row.id !== rotateTarget.id)
          .concat(result.apiKey ? [result.apiKey] : [])
      );
      setRotateTarget(null);
      setShowOnceKey(result.keyPlaintext ?? null);
      setShowOnceOpened(true);
      router.refresh();
    });
  };

  const handleRevoke = () => {
    if (!revokeTarget) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revokeApiKeyClient(organizationId, revokeTarget.id);
      if (result.error) {
        setError(result.error);
        return;
      }

      setKeys((current) => current.filter((row) => row.id !== revokeTarget.id));
      setRevokeTarget(null);
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>{workspaceName} API keys</Title>
        <Button
          data-testid="create-api-key-btn"
          onClick={() => setCreateOpened(true)}
        >
          Create API key
        </Button>
      </Group>

      <Text c="dimmed" size="sm">
        Workspace: /w/{workspaceSlug}/settings/api-keys
      </Text>

      {error ? (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      ) : null}

      <Table data-testid="api-keys-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Prefix</Table.Th>
            <Table.Th>Scopes</Table.Th>
            <Table.Th>Last used</Table.Th>
            <Table.Th>Expires</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {keys.map((keyRow) => (
            <Table.Tr data-testid={`api-key-row-${keyRow.id}`} key={keyRow.id}>
              <Table.Td>{keyRow.name}</Table.Td>
              <Table.Td data-testid={`api-key-prefix-${keyRow.id}`}>
                …{keyRow.keyPrefix}
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {keyRow.scopes.map((scope) => (
                    <Badge key={scope} size="sm" variant="light">
                      {scope}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>{formatRelativeTime(keyRow.lastUsedAt)}</Table.Td>
              <Table.Td>
                {keyRow.expiresAt
                  ? new Date(keyRow.expiresAt).toLocaleString()
                  : "—"}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button
                    data-testid={`rotate-api-key-${keyRow.id}`}
                    onClick={() => setRotateTarget(keyRow)}
                    size="xs"
                    variant="light"
                  >
                    Rotate
                  </Button>
                  <Button
                    color="red"
                    data-testid={`revoke-api-key-${keyRow.id}`}
                    onClick={() => setRevokeTarget(keyRow)}
                    size="xs"
                    variant="light"
                  >
                    Revoke
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        onClose={() => setCreateOpened(false)}
        opened={createOpened}
        title="Create API key"
      >
        <Stack gap="md">
          <TextInput
            data-testid="api-key-name-input"
            label="Name"
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
          <Checkbox.Group
            data-testid="api-key-scopes"
            label="Scopes"
            onChange={setScopes}
            value={scopes}
          >
            <Stack gap="xs">{scopeOptions}</Stack>
          </Checkbox.Group>
          <TextInput
            data-testid="api-key-expires"
            label="Expires at (optional)"
            onChange={(event) => setExpiresAt(event.currentTarget.value)}
            type="datetime-local"
            value={expiresAt}
          />
          <Group justify="flex-end">
            <Button onClick={() => setCreateOpened(false)} variant="subtle">
              Cancel
            </Button>
            <Button
              data-testid="submit-create-api-key"
              loading={isPending}
              onClick={handleCreate}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        closeOnClickOutside={false}
        data-testid="api-key-show-once-modal"
        onClose={() => {
          setShowOnceOpened(false);
          setShowOnceKey(null);
        }}
        opened={showOnceOpened}
        title="Save your API key"
      >
        <Stack gap="md">
          <Text size="sm">
            Copy this key now. It will not be shown again.
          </Text>
          <Group align="flex-end" gap="sm">
            <Text
              data-testid="api-key-plaintext-once"
              ff="monospace"
              size="sm"
              style={{ wordBreak: "break-all" }}
            >
              {showOnceKey}
            </Text>
            {showOnceKey ? (
              <CopyKeyButton testId="copy-api-key-once" value={showOnceKey} />
            ) : null}
          </Group>
          <Button
            data-testid="dismiss-api-key-once"
            onClick={() => {
              setShowOnceOpened(false);
              setShowOnceKey(null);
            }}
          >
            I&apos;ve saved this
          </Button>
        </Stack>
      </Modal>

      <Modal
        onClose={() => setRotateTarget(null)}
        opened={Boolean(rotateTarget)}
        title="Rotate API key"
      >
        <Stack gap="md">
          <Text size="sm">
            Rotating will revoke the current key immediately and issue a new one.
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setRotateTarget(null)} variant="subtle">
              Cancel
            </Button>
            <Button loading={isPending} onClick={handleRotate}>
              Rotate key
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        onClose={() => setRevokeTarget(null)}
        opened={Boolean(revokeTarget)}
        title="Revoke API key"
      >
        <Stack gap="md">
          <Text c="red" size="sm">
            Revoked keys stop working immediately.
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setRevokeTarget(null)} variant="subtle">
              Cancel
            </Button>
            <Button color="red" loading={isPending} onClick={handleRevoke}>
              Revoke key
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
