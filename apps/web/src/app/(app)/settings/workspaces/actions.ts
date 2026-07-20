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

export async function createWorkspaceClient(name: string): Promise<{
  error?: string;
}> {
  const response = await apiFetch("/api/v1/workspaces", {
    body: JSON.stringify({ name }),
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to create workspace." };
  }

  return {};
}

export async function togglePinClient(
  pinnedWorkspaceIds: string[]
): Promise<{ error?: string }> {
  const response = await apiFetch("/api/v1/user/preferences", {
    body: JSON.stringify({ pinnedWorkspaceIds }),
    method: "PATCH",
  });

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return {
      error: body.error?.message ?? "Unable to update pinned workspaces.",
    };
  }

  return {};
}

export async function updatePinOrderClient(
  pinnedWorkspaceIds: string[]
): Promise<{ error?: string }> {
  return await togglePinClient(pinnedWorkspaceIds);
}

export async function createProjectClient(
  organizationId: string,
  name: string
): Promise<{
  error?: string;
  ingestKeyPlaintext?: string;
  project?: { id: string; slug: string };
}> {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/projects`,
    {
      body: JSON.stringify({ name }),
      method: "POST",
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to create project." };
  }

  const body = (await response.json()) as {
    ingestKeyPlaintext: string;
    project: { id: string; slug: string };
  };

  return {
    ingestKeyPlaintext: body.ingestKeyPlaintext,
    project: body.project,
  };
}

export async function rotateIngestKeyClient(projectId: string): Promise<{
  error?: string;
  ingestKeyPlaintext?: string;
}> {
  const response = await apiFetch(
    `/api/v1/projects/${projectId}/ingest-keys/rotate`,
    { method: "POST" }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to rotate ingest key." };
  }

  const body = (await response.json()) as { ingestKeyPlaintext: string };
  return { ingestKeyPlaintext: body.ingestKeyPlaintext };
}

export async function deleteProjectClient(projectId: string): Promise<{
  error?: string;
}> {
  const response = await apiFetch(`/api/v1/projects/${projectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to delete project." };
  }

  return {};
}
