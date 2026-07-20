"use client";

import { Alert, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface LinearStatus {
  connected: boolean;
  connectedAt?: string;
}

export function LinearSettings({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const [status, setStatus] = useState<LinearStatus>({ connected: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/integrations/linear/status`,
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("Failed to load Linear status.");
      }
      const body = (await response.json()) as { data: LinearStatus };
      setStatus(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connectLinear() {
    setError(null);
    const response = await fetch(
      `${apiBase}/api/v1/integrations/linear/authorize`,
      { credentials: "include" }
    );
    if (!response.ok) {
      setError("Could not start Linear OAuth.");
      return;
    }
    const body = (await response.json()) as { data: { url: string } };
    window.location.href = body.data.url;
  }

  async function disconnectLinear() {
    setError(null);
    const response = await fetch(
      `${apiBase}/api/v1/integrations/linear/disconnect`,
      { credentials: "include", method: "POST" }
    );
    if (!response.ok) {
      setError("Disconnect failed.");
      return;
    }
    await refresh();
  }

  return (
    <Stack gap="md">
      <Title order={2}>Linear integration</Title>
      <Text c="dimmed" size="sm">
        Connect Linear to push reports into your tracker (workspace /w/
        {workspaceSlug}).
      </Text>
      {error ? <Alert color="red">{error}</Alert> : null}
      {status.connected ? (
        <Stack gap="xs">
          <Text size="sm">
            Connected
            {status.connectedAt
              ? ` since ${new Date(status.connectedAt).toLocaleString()}`
              : ""}
            .
          </Text>
          <Group>
            <Button color="red" onClick={() => void disconnectLinear()} variant="light">
              Disconnect
            </Button>
          </Group>
        </Stack>
      ) : (
        <Button disabled={loading} onClick={() => void connectLinear()}>
          Connect Linear
        </Button>
      )}
    </Stack>
  );
}
