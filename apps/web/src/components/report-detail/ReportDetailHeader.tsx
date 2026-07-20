"use client";

import { Alert, Anchor, Button, Group, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useLinearPush } from "@/lib/reports/use-linear-push";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function ReportDetailHeader({
  linearIssueUrl,
  reportId,
  title,
  workspaceSlug,
}: {
  linearIssueUrl: string | null;
  reportId: string;
  title: string;
  workspaceSlug: string;
}) {
  const { clearTokenExpired, isPending, push, tokenExpired } = useLinearPush(reportId);

  async function reconnectLinear() {
    clearTokenExpired();
    const response = await fetch(`${apiBase}/api/v1/integrations/linear/authorize`, {
      credentials: "include",
    });
    if (!response.ok) {
      return;
    }
    const body = (await response.json()) as { data: { url: string } };
    window.location.href = body.data.url;
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>{title}</Title>
        <Group gap="sm">
          {linearIssueUrl ? (
            <Anchor
              data-testid="report-linear-issue-link"
              href={linearIssueUrl}
              rel="noreferrer"
              target="_blank"
            >
              Linear issue
            </Anchor>
          ) : null}
          <Button
            data-testid="report-push-linear"
            loading={isPending}
            onClick={push}
            variant="light"
          >
            Push to Linear
          </Button>
        </Group>
      </Group>
      {tokenExpired ? (
        <Alert color="yellow" title="Linear token expired.">
          <Group justify="space-between">
            <Text size="sm">Reconnect Linear to retry push.</Text>
            <Button onClick={reconnectLinear} size="xs" variant="default">
              Reconnect
            </Button>
          </Group>
        </Alert>
      ) : null}
      <Text c="dimmed" size="xs">
        Press <kbd>p</kbd> to push ·{" "}
        <Link href={`/w/${workspaceSlug}/settings/integrations/linear`}>
          Linear settings
        </Link>
      </Text>
    </Stack>
  );
}
