"use client";

import {
  Alert,
  Button,
  Center,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { authClient } from "../../../lib/auth-client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubSignIn = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        callbackURL: `${window.location.origin}/auth/callback`,
        provider: "github",
      });
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "GitHub sign-in failed."
      );
      setLoading(false);
    }
  }, []);

  return (
    <Center mih="100vh" px="md">
      <Paper maw={400} p="xl" radius="md" shadow="sm" w="100%" withBorder>
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Sign in</Title>
            <Text c="dimmed" size="sm">
              Continue with GitHub to access your workspaces.
            </Text>
          </Stack>

          {(oauthError || error) && (
            <Alert color="red" title="Sign-in failed" variant="light">
              {error ?? oauthError}
            </Alert>
          )}

          <Button
            fullWidth
            loading={loading}
            onClick={handleGitHubSignIn}
            variant="filled"
          >
            Continue with GitHub
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
