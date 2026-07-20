"use server";

import { headers } from "next/headers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function createWorkspaceAction(name: string): Promise<{
  error?: string;
  slug?: string;
}> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Workspace name is required." };
  }

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";

  const response = await fetch(`${apiUrl}/api/v1/onboarding/workspace`, {
    body: JSON.stringify({ name: trimmed }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return {
      error: body.error?.message ?? "Unable to create workspace.",
    };
  }

  const body = (await response.json()) as {
    organization: { slug: string };
  };

  return { slug: body.organization.slug };
}
