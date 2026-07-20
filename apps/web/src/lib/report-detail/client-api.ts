"use client";

import type { ReplayManifestResponse, ReportDetailRecord } from "./types";

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
