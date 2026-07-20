"use client";

import { Center, Loader, Stack, Text } from "@mantine/core";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { authClient } from "../../../../lib/auth-client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function completeCallback() {
      const error = searchParams.get("error");
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      const session = await authClient.getSession();
      if (cancelled) {
        return;
      }

      if (session.data?.session) {
        router.replace("/");
        return;
      }

      router.replace("/login?error=missing_session");
    }

    completeCallback();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <Center mih="100vh">
      <Stack align="center" gap="sm">
        <Loader size="sm" />
        <Text c="dimmed" size="sm">
          Completing sign-in…
        </Text>
      </Stack>
    </Center>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackContent />
    </Suspense>
  );
}
