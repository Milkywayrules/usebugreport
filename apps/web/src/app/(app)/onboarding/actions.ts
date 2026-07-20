"use server";

import { headers } from "next/headers";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch(path: string, init: RequestInit = {}) {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";

  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...init.headers,
    },
  });
}

export async function createWorkspaceAction(
  name: string,
  projectName?: string
): Promise<{
  error?: string;
  ingestKeyPlaintext?: string;
  organizationId?: string;
  projectId?: string;
  slug?: string;
}> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Workspace name is required." };
  }

  const response = await apiFetch("/api/v1/onboarding/workspace", {
    body: JSON.stringify({
      name: trimmed,
      projectName: projectName?.trim() || "My App",
    }),
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
    ingestKeyPlaintext?: string;
    organization: { id: string; slug: string };
    project?: { id: string };
  };

  return {
    ingestKeyPlaintext: body.ingestKeyPlaintext,
    organizationId: body.organization.id,
    projectId: body.project?.id,
    slug: body.organization.slug,
  };
}

export async function fetchFirstReportIdAction(): Promise<string | null> {
  const response = await apiFetch("/api/v1/reports?limit=1");
  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    data: Array<{ id: string }>;
  };

  return body.data[0]?.id ?? null;
}
