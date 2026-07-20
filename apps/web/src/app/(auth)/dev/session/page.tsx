import { Code, Container, Stack, Text, Title } from "@mantine/core";
import { redirect } from "next/navigation";
import { getServerSession } from "../../../../lib/auth-server";

export default async function DevSessionPage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/login");
  }

  const { organizations, session, user } = await getServerSession();

  return (
    <Container py="xl" size="sm">
      <Stack gap="md">
        <Title order={3}>Dev session probe</Title>
        <Text c="dimmed" size="sm">
          Organization membership count exposed from session helper.
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
