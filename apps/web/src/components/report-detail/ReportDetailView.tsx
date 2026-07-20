"use client";

import { Alert, Group, Stack, Tabs, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { fetchReportDetail } from "@/lib/report-detail/client-api";
import { ConsolePanel } from "./ConsolePanel";
import { MetadataPanel } from "./MetadataPanel";
import { NetworkPanel } from "./NetworkPanel";
import { ReplayViewer } from "./ReplayViewer";

export function ReportDetailView({
  reportId,
  workspaceSlug,
}: {
  reportId: string;
  workspaceSlug: string;
}) {
  const reportQuery = useQuery({
    queryFn: () => fetchReportDetail(reportId),
    queryKey: ["report", reportId, "detail"],
  });

  if (reportQuery.isLoading) {
    return <Title order={3}>Loading report…</Title>;
  }

  if (reportQuery.isError) {
    const status = (reportQuery.error as Error & { status?: number }).status;
    if (status === 403) {
      return (
        <Alert color="red" title="Access denied">
          You do not have permission to view this report.
        </Alert>
      );
    }
    return (
      <Alert color="red" title="Report unavailable">
        This report could not be loaded.
      </Alert>
    );
  }

  const report = reportQuery.data;
  if (!report || report.workspaceSlug !== workspaceSlug) {
    return (
      <Alert color="red" title="Report not found">
        Report {reportId} is not in workspace {workspaceSlug}.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>{report.title}</Title>
      </Group>
      <Tabs defaultValue="replay">
        <Tabs.List>
          <Tabs.Tab value="replay">Replay</Tabs.Tab>
          <Tabs.Tab value="console">Console</Tabs.Tab>
          <Tabs.Tab value="network">Network</Tabs.Tab>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel pt="md" value="replay">
          <ReplayViewer reportId={reportId} />
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="console">
          <ConsolePanel reportId={reportId} />
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="network">
          <NetworkPanel reportId={reportId} />
        </Tabs.Panel>
        <Tabs.Panel pt="md" value="metadata">
          <MetadataPanel report={report} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
