"use client";

import { Kbd, Modal, Stack, Table, Text, Title } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import {
  formatShortcutKeys,
  groupShortcutsForModal,
} from "@/keyboard/shortcuts";

interface KeyboardShortcutsModalProps {
  onClose: () => void;
  opened: boolean;
}

export function KeyboardShortcutsModal({
  onClose,
  opened,
}: KeyboardShortcutsModalProps) {
  const os = useOs();
  const isMac = os === "macos" || os === "ios";
  const groups = groupShortcutsForModal();

  return (
    <Modal
      onClose={onClose}
      opened={opened}
      size="lg"
      title="Keyboard shortcuts"
    >
      <Stack gap="lg">
        {groups.map(({ group, items }) => (
          <Stack gap="xs" key={group}>
            <Title order={5}>{group}</Title>
            <Table striped withTableBorder>
              <Table.Tbody>
                {items.map((shortcut) => (
                  <Table.Tr key={shortcut.id}>
                    <Table.Td w={160}>
                      <Kbd>{formatShortcutKeys(shortcut.keys, isMac)}</Kbd>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{shortcut.label}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ))}
      </Stack>
    </Modal>
  );
}
