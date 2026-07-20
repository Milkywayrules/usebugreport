"use client";

import { Code, Stack, Text } from "@mantine/core";
import type { ReportDetailRecord } from "@/lib/report-detail/types";

export function MetadataPanel({ report }: { report: ReportDetailRecord }) {
  return (
    <Stack gap="sm">
      <Text size="sm">Status: {report.status}</Text>
      <Text size="sm">Ingest: {report.ingestStatus}</Text>
      <Code block>{JSON.stringify(report.environment, null, 2)}</Code>
      {report.summaryText ? <Text size="sm">{report.summaryText}</Text> : null}
      <Code block>{JSON.stringify(report.summary, null, 2)}</Code>
    </Stack>
  );
}
