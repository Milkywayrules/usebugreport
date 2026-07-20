import { Code, Container, Stack, Text, Title } from "@mantine/core";
import { getServerSession } from "../../../../lib/auth-server";

export default async function DevSessionPage() {
  const { organizations, session, user } = await getServerSession();

  return (
    <Container py="xl" size="sm">
      <Stack gap="md">
        <Title order={3}>Dev session probe</Title>
        <Text c="dimmed" size="sm">
          E4-S2 handoff: organization membership count exposed from session
          helper.
        </Text>
        <Code block>
          {JSON.stringify(
            {
              organizationCount: organizations.length,
              organizations,
              session,
              user,
            },
            null,
            2
          )}
        </Code>
      </Stack>
    </Container>
  );
}
