"use client";

import { Affix, Button, Group, Menu, Text, Tooltip } from "@mantine/core";
import {
  REPORT_STATUS_LABELS,
  REPORT_STATUS_VALUES,
  type ReportStatusValue,
} from "@/lib/reports/status";

interface BulkStatusBarProps {
  linearConnected?: boolean;
  onChangeStatus: (status: ReportStatusValue) => void;
  onClear: () => void;
  onPushLinear?: () => void;
  selectedCount: number;
}

export function BulkStatusBar({
  linearConnected = false,
  onChangeStatus,
  onClear,
  onPushLinear,
  selectedCount,
}: BulkStatusBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  const pushButton = (
    <Button
      data-testid="bulk-push-linear"
      disabled={!linearConnected}
      onClick={onPushLinear}
      size="xs"
      variant="light"
    >
      Push to Linear
    </Button>
  );

  return (
    <Affix
      bottom={24}
      position={{ bottom: 24, left: "50%" }}
      style={{ transform: "translateX(-50%)" }}
    >
      <Group
        aria-label="Bulk actions"
        data-testid="bulk-status-bar"
        gap="sm"
        p="md"
        style={{
          background: "var(--mantine-color-dark-7)",
          border: "1px solid var(--mantine-color-dark-4)",
          borderRadius: "var(--mantine-radius-md)",
          boxShadow: "var(--mantine-shadow-md)",
        }}
      >
        <Text fw={600} size="sm">
          {selectedCount} selected
        </Text>
        <Menu withinPortal>
          <Menu.Target>
            <Button size="xs" variant="light">
              Change status
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {REPORT_STATUS_VALUES.map((status) => (
              <Menu.Item key={status} onClick={() => onChangeStatus(status)}>
                {REPORT_STATUS_LABELS[status]}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        {linearConnected ? (
          pushButton
        ) : (
          <Tooltip label="Connect Linear in Settings">{pushButton}</Tooltip>
        )}
        <Button onClick={onClear} size="xs" variant="subtle">
          Clear
        </Button>
      </Group>
    </Affix>
  );
}
