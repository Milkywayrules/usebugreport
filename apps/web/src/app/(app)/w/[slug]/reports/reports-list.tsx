"use client";

import { notifications } from "@mantine/notifications";
import {
  Badge,
  Checkbox,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReportListRow } from "@/lib/api-server";

import { BulkStatusBar } from "@/components/reports/bulk-status-bar";
import {
  REPORT_STATUS_BY_DIGIT,
  type ReportStatusValue,
} from "@/lib/reports/status";
import { patchReportStatus } from "@/lib/reports/update-status-api";
import { GLOBAL_SHORTCUTS } from "@/keyboard/shortcuts";
import { useHotkeys } from "@mantine/hooks";
import { useReportListHotkeys } from "@/keyboard/use-report-list-hotkeys";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatAge(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

async function loadReports(query: URLSearchParams): Promise<{
  data: ReportListRow[];
  page: { hasMore: boolean; nextCursor: string | null };
}> {
  const response = await fetch(`${apiUrl}/api/v1/reports?${query.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to load reports");
  }
  return response.json();
}

interface ReportsListProps {
  canEdit: boolean;
  organizationId: string;
  projects: Array<{ id: string; name: string }>;
  workspaceSlug: string;
}

export function ReportsList({
  canEdit,
  organizationId,
  projects,
  workspaceSlug,
}: ReportsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const status = searchParams.get("status") ?? "";
  const project = searchParams.get("project") ?? "";
  const q = searchParams.get("q") ?? "";
  const since = searchParams.get("since") ?? "";

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (project) params.set("project", project);
    if (q) params.set("q", q);
    if (since) params.set("since", since);
    params.set("limit", "50");
    return params;
  }, [project, q, since, status]);

  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["reports", organizationId, queryString.toString()],
    queryFn: () => loadReports(queryString),
  });

  const rows = reportsQuery.data?.data ?? [];

  const applyStatusMutation = useMutation({
    mutationFn: async ({
      reportIds,
      status,
    }: {
      reportIds: string[];
      status: ReportStatusValue;
    }) => {
      const results = await Promise.allSettled(
        reportIds.map((id) => patchReportStatus(id, status))
      );
      const failed = results.filter((row) => row.status === "rejected").length;
      const updated = reportIds.length - failed;
      return { failed, status, updated };
    },
    onMutate: async ({ reportIds, status }) => {
      const key = ["reports", organizationId, queryString.toString()];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{
        data: ReportListRow[];
        page: { hasMore: boolean; nextCursor: string | null };
      }>(key);
      if (previous) {
        queryClient.setQueryData(key, {
          ...previous,
          data: previous.data.map((row) =>
            reportIds.includes(row.id) ? { ...row, status } : row
          ),
        });
      }
      return { key, previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      notifications.show({
        color: "red",
        message: "Status update failed.",
        title: "Bulk update",
      });
    },
    onSuccess: ({ failed, updated }) => {
      if (failed > 0) {
        notifications.show({
          color: "yellow",
          message: `${updated} updated, ${failed} failed`,
          title: "Bulk update",
        });
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context?.key) {
        queryClient.invalidateQueries({ queryKey: context.key });
      }
    },
  });

  const applyStatusToTargets = (status: ReportStatusValue) => {
    if (!canEdit) return;
    const focused = rows[focusedIndex];
    const targetIds =
      selected.size > 0
        ? [...selected]
        : focused
          ? [focused.id]
          : [];
    if (targetIds.length === 0) return;
    applyStatusMutation.mutate({ reportIds: targetIds, status });
  };



  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`/w/${workspaceSlug}/reports?${params.toString()}`);
    },
    [router, searchParams, workspaceSlug]
  );

  const columns = useMemo<ColumnDef<ReportListRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all visible"
            checked={
              rows.length > 0 && rows.every((row) => selected.has(row.id))
            }
            disabled={!canEdit}
            onChange={() => {
              if (!canEdit) return;
              const next = new Set(selected);
              const allSelected = rows.every((row) => next.has(row.id));
              if (allSelected) {
                for (const row of rows) next.delete(row.id);
              } else {
                for (const row of rows) next.add(row.id);
              }
              setSelected(next);
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.title}`}
            checked={selected.has(row.original.id)}
            disabled={!canEdit}
            onChange={() => {
              if (!canEdit) return;
              const next = new Set(selected);
              if (next.has(row.original.id)) next.delete(row.original.id);
              else next.add(row.original.id);
              setSelected(next);
            }}
          />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge data-testid={`report-status-${row.original.id}`} variant="light">
            {row.original.status}
          </Badge>
        ),
      },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "projectName", header: "Project" },
      {
        accessorKey: "reporterLabel",
        header: "Reporter",
        cell: ({ row }) => row.original.reporterLabel ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: "Age",
        cell: ({ row }) => formatAge(row.original.createdAt),
      },
      {
        id: "linear",
        header: "Linear",
        cell: ({ row }) =>
          row.original.linearIssueUrl ? (
            <Text c="blue" component="span" size="sm">
              Linked
            </Text>
          ) : (
            "—"
          ),
      },
    ],
    [canEdit, rows, selected]
  );

  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    tableRef.current?.focus();
    setFocusedIndex(0);
  }, [queryString.toString()]);


  const focusedRow = rows[focusedIndex];

  useReportListHotkeys({
    canEdit,
    onFocusNext: () => {
      setFocusedIndex((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
    },
    onFocusPrev: () => {
      setFocusedIndex((index) => Math.max(index - 1, 0));
    },
    onFocusSearch: () => {
      searchRef.current?.focus();
    },
    onOpenDetail: () => {
      if (focusedRow) {
        router.push(`/w/${workspaceSlug}/reports/${focusedRow.id}`);
      }
    },
    onOpenNewTab: () => {
      if (focusedRow) {
        window.open(`/w/${workspaceSlug}/reports/${focusedRow.id}`, "_blank");
      }
    },
    onSelectAllVisible: () => {
      setSelected(new Set(rows.map((row) => row.id)));
    },
    onStatusDigit: (digit) => {
      const status = REPORT_STATUS_BY_DIGIT[digit];
      if (status) applyStatusToTargets(status);
    },
    onToggleSelect: () => {
      if (!focusedRow) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(focusedRow.id)) next.delete(focusedRow.id);
        else next.add(focusedRow.id);
        return next;
      });
    },
  });


  useHotkeys([
    [
      GLOBAL_SHORTCUTS.escape.keys,
      (event) => {
        if (selected.size === 0) return;
        event.preventDefault();
        setSelected(new Set());
      },
    ],
  ]);


  return (
    <Stack gap="md">
      <Title order={2}>Reports</Title>
      <Group align="end" grow preventGrowOverflow={false} wrap="wrap">
        <TextInput
          label="Search"
          placeholder="Filter title or description"
          ref={searchRef}
          value={q}
          onChange={(event) => updateParam("q", event.currentTarget.value)}
        />
        <Select
          clearable
          data={[
            { label: "Open", value: "open" },
            { label: "In progress", value: "in_progress" },
            { label: "Resolved", value: "resolved" },
            { label: "Closed", value: "closed" },
            { label: "Duplicate", value: "duplicate" },
          ]}
          label="Status"
          value={status || null}
          onChange={(value) => updateParam("status", value ?? "")}
        />
        <Select
          clearable
          data={projects.map((item) => ({
            label: item.name,
            value: item.id,
          }))}
          label="Project"
          value={project || null}
          onChange={(value) => updateParam("project", value ?? "")}
        />
      </Group>

      <div
        aria-label="Reports table"
        ref={tableRef}
        role="grid"
        tabIndex={0}
      >
        <Table highlightOnHover striped withTableBorder>
          <Table.Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.Th key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </Table.Th>
                ))}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {table.getRowModel().rows.map((row, index) => (
              <Table.Tr
                aria-selected={index === focusedIndex}
                data-testid={`report-row-${row.original.id}`}
                key={row.id}
                style={{
                  outline:
                    index === focusedIndex ? "2px solid var(--mantine-color-blue-5)" : undefined,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>
                    {cell.column.id === "title" ? (
                      <Text
                        component={Link}
                        href={`/w/${workspaceSlug}/reports/${row.original.id}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Text>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>

      {reportsQuery.isError ? (
        <Text c="red">Unable to load reports.</Text>
      ) : null}
      {!reportsQuery.isLoading && rows.length === 0 ? (
        <Text c="dimmed">No reports match these filters.</Text>
      ) : null}
      <BulkStatusBar
        onChangeStatus={applyStatusToTargets}
        onClear={() => setSelected(new Set())}
        selectedCount={selected.size}
      />
    </Stack>
  );
}
