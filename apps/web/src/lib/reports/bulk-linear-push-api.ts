const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface LinearPushResult {
  externalUrl?: string;
  operationId: string;
  status: "pending" | "succeeded";
}

export async function pushReportToLinear(
  reportId: string,
  options: { retry?: boolean } = {}
): Promise<LinearPushResult> {
  const response = await fetch(
    `${apiUrl}/api/v1/reports/${reportId}/linear/push`,
    {
      body: JSON.stringify(options.retry ? { retry: true } : {}),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );

  const body = (await response.json()) as {
    data?: LinearPushResult;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message ?? "Linear push failed.");
  }

  if (!body.data) {
    throw new Error("Linear push returned no data.");
  }

  return body.data;
}

export async function fetchLinearIntegrationConnected(): Promise<boolean> {
  const response = await fetch(`${apiUrl}/api/v1/integrations/linear/status`, {
    credentials: "include",
  });
  if (!response.ok) {
    return false;
  }
  const body = (await response.json()) as { data?: { connected?: boolean } };
  return body.data?.connected === true;
}
