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
    return { data: [] as ApiKeyRow[], error: "Unable to load API keys." };
  }
  const body = (await response.json()) as { data: ApiKeyRow[] };
  return { data: body.data };
}

export async function createApiKeyClient(
  organizationId: string,
  input: { expiresAt?: string | null; name: string; scopes: string[] }
): Promise<{ apiKey?: ApiKeyRow; error?: string; keyPlaintext?: string }> {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/api-keys`,
    {
      body: JSON.stringify(input),
      method: "POST",
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to create API key." };
  }

  const body = (await response.json()) as {
    apiKey: ApiKeyRow;
    keyPlaintext: string;
  };
  return { apiKey: body.apiKey, keyPlaintext: body.keyPlaintext };
}

export async function rotateApiKeyClient(
  organizationId: string,
  keyId: string
): Promise<{ apiKey?: ApiKeyRow; error?: string; keyPlaintext?: string }> {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/api-keys/${keyId}/rotate`,
    { method: "POST" }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to rotate API key." };
  }

  const body = (await response.json()) as {
    apiKey: ApiKeyRow;
    keyPlaintext: string;
  };
  return { apiKey: body.apiKey, keyPlaintext: body.keyPlaintext };
}

export async function revokeApiKeyClient(
  organizationId: string,
  keyId: string
): Promise<{ error?: string }> {
  const response = await apiFetch(
    `/api/v1/workspaces/${organizationId}/api-keys/${keyId}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? "Unable to revoke API key." };
  }

  return {};
}
