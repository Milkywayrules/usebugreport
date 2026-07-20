"use client";

import { Code, Group, Stack, Text, TextInput } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchNetworkRequests } from "@/lib/report-detail/client-api";
import {
  filterNetworkRows,
  redactBody,
  type NetworkRow,
} from "@/lib/report-detail/filters";

export function NetworkPanel({ reportId }: { reportId: string }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [hostFilter, setHostFilter] = useState("");
  const query = useQuery({
    queryFn: () => fetchNetworkRequests(reportId),
    queryKey: ["report", reportId, "network"],
  });

  const rows = useMemo(() => {
    const data = (query.data ?? []) as NetworkRow[];
    return filterNetworkRows(data, statusFilter, hostFilter);
  }, [query.data, statusFilter, hostFilter]);

  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput
          label="Status code"
          onChange={(event) => setStatusFilter(event.currentTarget.value)}
          placeholder="500"
          value={statusFilter}
        />
        <TextInput
          label="Host contains"
          onChange={(event) => setHostFilter(event.currentTarget.value)}
          placeholder="api."
          value={hostFilter}
        />
      </Group>
      {rows.length === 0 ? (
        <Text c="dimmed">No network requests match.</Text>
      ) : (
        rows.map((row, index) => (
          <Stack gap={4} key={`${row.request?.url ?? index}-${index}`}>
            <Text size="sm">
              {row.response?.status ?? "?"} {row.request?.host ?? row.request?.url}
            </Text>
            <Code block>{redactBody(row.response?.body)}</Code>
          </Stack>
        ))
      )}
    </Stack>
  );
}
