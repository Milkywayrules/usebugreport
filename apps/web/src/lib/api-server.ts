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
    capabilities: {
      canDelete: boolean;
      canManageMembers: boolean;
      canRotate: boolean;
      canUpdate: boolean;
      effectiveRole: string | null;
      source: string;
    };
    project: {
      createdAt: string;
      id: string;
      name: string;
      slug: string;
    };
  };
  return body;
}

export async function fetchProjectMembers(projectId: string) {
  const response = await apiFetch(`/api/v1/projects/${projectId}/members`);
  if (!response.ok) {
    return { data: [] as ProjectMemberRow[] };
  }
  const body = (await response.json()) as { data: ProjectMemberRow[] };
  return body;
}

export async function fetchWorkspaceMembers(organizationId: string) {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/members`
  );
  if (!response.ok) {
    return { data: [] as WorkspaceMemberRow[] };
  }
  const body = (await response.json()) as { data: WorkspaceMemberRow[] };
  return body;
}

export interface ApiKeyRow {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  name: string;
  revokedAt: string | null;
  scopes: string[];
}

export async function fetchApiKeys(organizationId: string) {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/api-keys`
  );
  if (!response.ok) {
    return { data: [] as ApiKeyRow[] };
  }
  const body = (await response.json()) as { data: ApiKeyRow[] };
  return { data: body.data };
}

export interface ProjectMemberRow {
  email: string;
  name: string;
  role: string;
  userId: string;
}

export interface WorkspaceMemberRow {
  email: string;
  name: string;
  role: string;
  userId: string;
}

export interface ReportLookup {
  id: string;
  workspaceSlug: string;
}

export async function fetchReport(
  reportId: string
): Promise<ReportLookup | null> {
  const response = await apiFetch(`/api/v1/reports/${reportId}`);
  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    data?: {
      id?: string;
      organizationSlug?: string;
      workspaceSlug?: string;
    };
    organizationSlug?: string;
    workspaceSlug?: string;
  };

  const data = body.data ?? body;
  const workspaceSlug =
    "workspaceSlug" in data
      ? (data.workspaceSlug ?? data.organizationSlug)
      : (body.workspaceSlug ?? body.organizationSlug);
  if (!workspaceSlug) {
    return null;
  }

  const reportIdFromBody =
    "id" in data && typeof data.id === "string" ? data.id : reportId;

  return {
    id: reportIdFromBody,
    workspaceSlug,
  };
}
