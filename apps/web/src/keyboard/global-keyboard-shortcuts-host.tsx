"use client";

import { useEffect } from "react";
import { useHotkeys } from "@mantine/hooks";
import { useDisclosure } from "@mantine/hooks";
import { GLOBAL_SHORTCUTS } from "@/keyboard/shortcuts";
import { isEditableTarget } from "@/keyboard/is-editable-target";
import { KeyboardShortcutsModal } from "@/keyboard/keyboard-shortcuts-modal";

export function GlobalKeyboardShortcutsHost() {
  const [opened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    const handler = () => open();
    window.addEventListener("ubr:open-shortcuts", handler);
    return () => window.removeEventListener("ubr:open-shortcuts", handler);
  }, [open]);

  useHotkeys([
    [
      GLOBAL_SHORTCUTS.help.keys,
      (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        open();
      },
    ],
  ]);

  return (
    <KeyboardShortcutsModal onClose={close} opened={opened} />
  );
}
