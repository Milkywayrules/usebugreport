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

export async function addProjectMemberClient(
  projectId: string,
  userId: string,
  role: string
): Promise<{ error?: string }> {
  const response = await apiFetch(`/api/v1/projects/${projectId}/members`, {
    body: JSON.stringify({ role, userId }),
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to add project member." };
  }

  return {};
}

export async function updateProjectMemberRoleClient(
  projectId: string,
  userId: string,
  role: string
): Promise<{ error?: string }> {
  const response = await apiFetch(
    `/api/v1/projects/${projectId}/members/${userId}`,
    {
      body: JSON.stringify({ role }),
      method: "PATCH",
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return {
      error: body.error?.message ?? "Unable to update project member.",
    };
  }

  return {};
}

export async function removeProjectMemberClient(
  projectId: string,
  userId: string
): Promise<{ error?: string }> {
  const response = await apiFetch(
    `/api/v1/projects/${projectId}/members/${userId}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return {
      error: body.error?.message ?? "Unable to remove project member.",
    };
  }

  return {};
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
