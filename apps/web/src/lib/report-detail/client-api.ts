"use client";

import type {
  ReplayManifestResponse,
  ReportCommentRecord,
  ReportCommentsResponse,
  ReportDetailRecord,
} from "./types";

async function clientFetch<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function fetchReportDetail(reportId: string) {
  return clientFetch<ReportDetailRecord>(`${apiBase}/api/v1/reports/${reportId}`);
}

export function fetchReplayManifest(reportId: string) {
  return clientFetch<ReplayManifestResponse>(
    `${apiBase}/api/v1/reports/${reportId}/replay-manifest`
  );
}

export function fetchConsoleLogs(reportId: string) {
  return clientFetch<unknown[]>(`${apiBase}/api/v1/reports/${reportId}/console-logs`);
}

export function fetchNetworkRequests(reportId: string) {
  return clientFetch<unknown[]>(
    `${apiBase}/api/v1/reports/${reportId}/network-requests`
  );
}

export async function fetchReportComments(reportId: string): Promise<ReportCommentsResponse> {
  const response = await fetch(`${apiBase}/api/web/reports/${reportId}/comments`, {
    credentials: "include",
  });
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const body = (await response.json()) as {
    data: ReportCommentRecord[];
    meta?: { canComment?: boolean };
  };
  return {
    canComment: body.meta?.canComment ?? false,
    comments: body.data,
  };
}

export async function createReportComment(
  reportId: string,
  body: string
): Promise<ReportCommentRecord> {
  const response = await fetch(`${apiBase}/api/web/reports/${reportId}/comments`, {
    body: JSON.stringify({ body }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { data: ReportCommentRecord };
  return payload.data;
}
