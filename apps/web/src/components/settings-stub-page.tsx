import { Stack, Text, Title } from "@mantine/core";

export function SettingsStubPage({ title }: { title: string }) {
  return (
    <Stack gap="sm" p="md">
      <Title order={2}>{title}</Title>
      <Text c="dimmed">Coming soon</Text>
    </Stack>
  );
}
