"use client";

import { useHotkeys, type HotkeyItem } from "@mantine/hooks";
import { useMemo } from "react";
import { isEditableTarget } from "@/keyboard/is-editable-target";
import { REPORT_LIST_SHORTCUTS } from "@/keyboard/shortcuts";

export interface ReportListHotkeyHandlers {
  onFocusNext: () => void;
  onFocusPrev: () => void;
  onFocusSearch: () => void;
  onOpenDetail: () => void;
  onOpenNewTab: () => void;
  onSelectAllVisible: () => void;
  onStatusDigit?: (digit: string) => void;
  onToggleSelect: () => void;
}

interface UseReportListHotkeysOptions extends ReportListHotkeyHandlers {
  canEdit: boolean;
  enabled?: boolean;
}

function shouldHandleKeyboard(
  event: KeyboardEvent,
  allowInEditable?: boolean
): boolean {
  if (allowInEditable) {
    return true;
  }
  return !isEditableTarget(event.target);
}

export function useReportListHotkeys({
  canEdit,
  enabled = true,
  onFocusNext,
  onFocusPrev,
  onFocusSearch,
  onOpenDetail,
  onOpenNewTab,
  onSelectAllVisible,
  onStatusDigit,
  onToggleSelect,
}: UseReportListHotkeysOptions): void {
  const hotkeys = useMemo(() => {
    if (!enabled) {
      return [] as HotkeyItem[];
    }

    const items: HotkeyItem[] = [
      [
        REPORT_LIST_SHORTCUTS.focusNext.keys,
        (event) => {
          if (!shouldHandleKeyboard(event)) return;
          event.preventDefault();
          onFocusNext();
        },
      ],
      [
        REPORT_LIST_SHORTCUTS.focusNextAlt.keys,
        (event) => {
          if (!shouldHandleKeyboard(event)) return;
          event.preventDefault();
          onFocusNext();
        },
      ],
      [
        REPORT_LIST_SHORTCUTS.focusPrev.keys,
        (event) => {
          if (!shouldHandleKeyboard(event)) return;
          event.preventDefault();
          onFocusPrev();
        },
      ],
      [
        REPORT_LIST_SHORTCUTS.focusPrevAlt.keys,
        (event) => {
          if (!shouldHandleKeyboard(event)) return;
          event.preventDefault();
          onFocusPrev();
        },
      ],
      [
        REPORT_LIST_SHORTCUTS.openDetail.keys,
        (event) => {
          if (!shouldHandleKeyboard(event)) return;
          event.preventDefault();
          onOpenDetail();
        },
      ],
      [
        REPORT_LIST_SHORTCUTS.focusSearch.keys,
        (event) => {
          if (!shouldHandleKeyboard(event, true)) return;
          event.preventDefault();
          onFocusSearch();
        },
      ],
    ];

    if (canEdit) {
      items.push(
        [
          REPORT_LIST_SHORTCUTS.toggleSelect.keys,
          (event) => {
            if (!shouldHandleKeyboard(event)) return;
            event.preventDefault();
            onToggleSelect();
          },
        ],
        [
          REPORT_LIST_SHORTCUTS.selectAllVisible.keys,
          (event) => {
            if (!shouldHandleKeyboard(event)) return;
            event.preventDefault();
            onSelectAllVisible();
          },
        ],
        [
          REPORT_LIST_SHORTCUTS.openNewTab.keys,
          (event) => {
            if (!shouldHandleKeyboard(event)) return;
            event.preventDefault();
            onOpenNewTab();
          },
        ]
      );

      if (onStatusDigit) {
        for (const digit of ["1", "2", "3", "4", "5"] as const) {
          items.push([
            digit,
            (event) => {
              if (!shouldHandleKeyboard(event)) return;
              event.preventDefault();
              onStatusDigit(digit);
            },
          ]);
        }
      }
    }

    return items;
  }, [
    canEdit,
    enabled,
    onFocusNext,
    onFocusPrev,
    onFocusSearch,
    onOpenDetail,
    onOpenNewTab,
    onSelectAllVisible,
    onStatusDigit,
    onToggleSelect,
  ]);

  useHotkeys(hotkeys);
}
