"use client";

import { Alert, Button, Checkbox, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const LAUNCH_EVENTS = ["report.created", "report.updated"] as const;
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface WebhookRow {
  createdAt: string;
  enabled: boolean;
  events: string[];
  id: string;
  url: string;
}

async function fetchWebhooks(): Promise<WebhookRow[]> {
  const response = await fetch(`${apiBase}/api/v1/webhooks`, { credentials: "include" });
  const body = (await response.json()) as { data?: WebhookRow[]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Failed to load webhooks.");
  }
  return body.data ?? [];
}

async function registerWebhook(input: { events: string[]; url: string }) {
  const response = await fetch(`${apiBase}/api/v1/webhooks`, {
    body: JSON.stringify(input),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const body = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Webhook registration failed.");
  }
}

export function WebhooksSettings({
  billingTier,
  workspaceSlug,
}: {
  billingTier: string;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([...LAUNCH_EVENTS]);

  const listQuery = useQuery({
    queryFn: fetchWebhooks,
    queryKey: ["webhooks", workspaceSlug],
  });

  const registerMutation = useMutation({
    mutationFn: () => registerWebhook({ events, url }),
    onSuccess: async () => {
      setUrl("");
      await queryClient.invalidateQueries({ queryKey: ["webhooks", workspaceSlug] });
    },
  });

  const tierBlocked = billingTier === "free";

  return (
    <Stack gap="md">
      <Title order={2}>Webhooks</Title>
      <Text c="dimmed" size="sm">
        Workspace /w/{workspaceSlug} — HTTPS endpoints for report lifecycle events.
      </Text>
      {tierBlocked ? (
        <Alert color="yellow" title="Pro tier required">
          Webhooks are available on Pro and above.
        </Alert>
      ) : null}
      <TextInput
        data-testid="webhook-url-input"
        label="Endpoint URL"
        placeholder="https://example.com/hooks/usebugreport"
        value={url}
        onChange={(event) => setUrl(event.currentTarget.value)}
      />
      <Checkbox.Group label="Events" value={events} onChange={setEvents}>
        {LAUNCH_EVENTS.map((event) => (
          <Checkbox key={event} label={event} value={event} />
        ))}
      </Checkbox.Group>
      <Group>
        <Button
          data-testid="webhook-register"
          disabled={tierBlocked || !url.trim()}
          loading={registerMutation.isPending}
          onClick={() => registerMutation.mutate()}
        >
          Save webhook
        </Button>
      </Group>
      {registerMutation.isError ? (
        <Alert color="red">{(registerMutation.error as Error).message}</Alert>
      ) : null}
      {listQuery.data?.map((row) => (
        <Text key={row.id} size="sm">
          {row.url} ({row.events.join(", ")})
        </Text>
      ))}
    </Stack>
  );
}
