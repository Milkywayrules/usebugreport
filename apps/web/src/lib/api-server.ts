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

export async function ensureActiveOrganization(organizationId: string) {
  const response = await apiFetch("/api/auth/organization/set-active", {
    body: JSON.stringify({ organizationId }),
    method: "POST",
  });
  return response.ok;
}

export async function fetchWorkspaces() {
  const response = await apiFetch("/api/v1/workspaces");
  if (!response.ok) {
    return { data: [], error: "Unable to load workspaces." };
  }
  const body = (await response.json()) as {
    data: Array<{
      billingTier: string;
      id: string;
      name: string;
      role: string;
      slug: string;
    }>;
  };
  return { data: body.data };
}

export async function fetchUserPreferences() {
  const response = await apiFetch("/api/v1/user/preferences");
  if (!response.ok) {
    return { pinnedWorkspaceIds: [] as string[] };
  }
  const body = (await response.json()) as {
    pinnedWorkspaceIds: string[];
  };
  return body;
}

export async function fetchProjects(organizationId: string) {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/projects`
  );
  if (!response.ok) {
    return { data: [], error: "Unable to load projects." };
  }
  const body = (await response.json()) as {
    data: Array<{
      createdAt: string;
      id: string;
      name: string;
      slug: string;
    }>;
  };
  return { data: body.data };
}

export async function fetchProject(projectId: string) {
  const response = await apiFetch(`/api/v1/projects/${projectId}`);
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as {
    project: {
      createdAt: string;
      id: string;
      name: string;
      slug: string;
    };
  };
  return body.project;
}
