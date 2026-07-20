"use client";

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
import { useQuery } from "@tanstack/react-query";
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

  const reportsQuery = useQuery({
    queryKey: ["reports", organizationId, queryString.toString()],
    queryFn: () => loadReports(queryString),
  });

  const rows = reportsQuery.data?.data ?? [];

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
        cell: ({ row }) => <Badge variant="light">{row.original.status}</Badge>,
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) {
        return;
      }

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "x" && canEdit) {
        event.preventDefault();
        const row = rows[focusedIndex];
        if (!row) return;
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(row.id)) next.delete(row.id);
          else next.add(row.id);
          return next;
        });
        return;
      }
      if (event.key === "X" && event.shiftKey && canEdit) {
        event.preventDefault();
        setSelected(new Set(rows.map((row) => row.id)));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[focusedIndex];
        if (row) {
          router.push(`/w/${workspaceSlug}/reports/${row.id}`);
        }
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, focusedIndex, router, rows, workspaceSlug]);

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
    </Stack>
  );
}
