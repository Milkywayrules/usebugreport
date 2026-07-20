export type ConsoleLevel = "debug" | "error" | "info" | "log" | "warn";

export interface ConsoleLogRow {
  level?: string;
  payload?: unknown[];
  trace?: unknown[];
}

export function filterConsoleLogs(
  rows: ConsoleLogRow[],
  level: ConsoleLevel | "all"
): ConsoleLogRow[] {
  if (level === "all") {
    return rows;
  }
  return rows.filter((row) => (row.level ?? "log") === level);
}

export interface NetworkRow {
  request?: {
    host?: string;
    url?: string;
  };
  response?: {
    status?: number;
    body?: unknown;
  };
}

export function filterNetworkRows(
  rows: NetworkRow[],
  statusFilter: string,
  hostFilter: string
): NetworkRow[] {
  const hostNeedle = hostFilter.trim().toLowerCase();
  const statusNeedle = statusFilter.trim();

  return rows.filter((row) => {
    const status = row.response?.status;
    if (statusNeedle && String(status ?? "") !== statusNeedle) {
      return false;
    }
    const host = (row.request?.host ?? row.request?.url ?? "").toLowerCase();
    if (hostNeedle && !host.includes(hostNeedle)) {
      return false;
    }
    return true;
  });
}

export function redactBody(body: unknown): string {
  if (body == null) {
    return "";
  }
  if (typeof body === "string") {
    return body.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  }
  return JSON.stringify(body, null, 2);
}
