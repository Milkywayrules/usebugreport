"use client";

import { Alert, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { env } from "@/env";

const apiBase = env.NEXT_PUBLIC_API_URL;

interface GitHubStatus {
  connected: boolean;
  connectedAt?: string;
}

export function GitHubSettings({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const searchParams = useSearchParams();
  const connectedBanner = searchParams.get("github") === "connected";

  const [status, setStatus] = useState<GitHubStatus>({ connected: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/integrations/github/status`,
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("Failed to load GitHub status.");
      }
      const body = (await response.json()) as { data: GitHubStatus };
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

  async function connectGitHub() {
    setError(null);
    const response = await fetch(
      `${apiBase}/api/v1/integrations/github/authorize`,
      { credentials: "include" }
    );
    if (!response.ok) {
      setError("Could not start GitHub OAuth.");
      return;
    }
    const body = (await response.json()) as { data: { url: string } };
    window.location.href = body.data.url;
  }

  async function disconnectGitHub() {
    setError(null);
    const response = await fetch(
      `${apiBase}/api/v1/integrations/github/disconnect`,
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
      <Title order={2}>GitHub integration</Title>
      <Text c="dimmed" size="sm">
        Connect GitHub to push reports as issues in your repositories (workspace
        /w/{workspaceSlug}).
      </Text>
      {connectedBanner ? (
        <Alert color="green" title="GitHub connected">
          OAuth completed successfully. Set a default repository per project from
          project settings when pushing reports.
        </Alert>
      ) : null}
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
            <Button
              color="red"
              onClick={() => void disconnectGitHub()}
              variant="light"
            >
              Disconnect
            </Button>
          </Group>
        </Stack>
      ) : (
        <Button disabled={loading} onClick={() => void connectGitHub()}>
          Connect GitHub
        </Button>
      )}
    </Stack>
  );
}
