"use client";

import { Code, Select, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchConsoleLogs } from "@/lib/report-detail/client-api";
import {
  filterConsoleLogs,
  type ConsoleLevel,
  type ConsoleLogRow,
} from "@/lib/report-detail/filters";

export function ConsolePanel({ reportId }: { reportId: string }) {
  const [level, setLevel] = useState<ConsoleLevel | "all">("all");
  const query = useQuery({
    queryFn: () => fetchConsoleLogs(reportId),
    queryKey: ["report", reportId, "console"],
  });

  const rows = useMemo(() => {
    const data = (query.data ?? []) as ConsoleLogRow[];
    return filterConsoleLogs(data, level);
  }, [query.data, level]);

  return (
    <Stack gap="sm">
      <Select
        data={[
          { label: "All levels", value: "all" },
          { label: "Debug", value: "debug" },
          { label: "Info", value: "info" },
          { label: "Log", value: "log" },
          { label: "Warn", value: "warn" },
          { label: "Error", value: "error" },
        ]}
        label="Level"
        onChange={(value) => setLevel((value as ConsoleLevel | "all") ?? "all")}
        value={level}
      />
      {rows.length === 0 ? (
        <Text c="dimmed">No console entries.</Text>
      ) : (
        rows.map((row, index) => (
          <Code block key={`${row.level}-${index}`}>
            [{row.level ?? "log"}] {JSON.stringify(row.payload ?? row.trace ?? row)}
          </Code>
        ))
      )}
    </Stack>
  );
}
